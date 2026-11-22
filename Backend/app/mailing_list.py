"""Blog mailing list: subscribe, unsubscribe, thank-you + post fan-out."""

from __future__ import annotations

import html
import logging
import re
import secrets
from typing import Any
from urllib.parse import urlencode

import jwt
from psycopg2.extras import Json

from app.announcement_sanitize import (
    extract_image_refs,
    parse_image_ref,
    sniff_image,
)
from app.announcements import (
    THUMBNAILS_DIR,
    card_image_path,
    media_storage_key,
)
from app.email_tokens import (
    _app_public_url,
    _html_wrap,
    _logo_inline,
    hash_token,
)
from app.mailer import EmailNotConfiguredError, send_email
from app.media_urls import resolve_media_file, storage_key
from app.security import ALGORITHM, signing_secret
from app.site_settings import coming_soon_or_false
from app.user_preferences import (
    merge_preference_patch,
    normalize_user_preferences,
)

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
STATUS_ACTIVE = "active"
STATUS_UNSUBSCRIBED = "unsubscribed"
JWT_PURPOSE_ACCOUNT = "blog_email_unsub"
JWT_PURPOSE_LIST = "blog_list_unsub"


def normalize_email(raw: str) -> str:
    return (raw or "").strip().lower()


def is_valid_email(email: str) -> bool:
    if not email:
        return False
    if len(email) > 254:
        return False
    return EMAIL_RE.match(email) is not None


def _new_raw_token() -> str:
    return secrets.token_urlsafe(32)


def _unsubscribe_url(raw_token: str) -> str:
    base = _app_public_url()
    query = urlencode({"token": raw_token})
    return f"{base}/unsubscribe?{query}"


def subscribe_email(cur, email: str) -> dict[str, Any]:
    """
    Upsert an active subscriber.

    Returns ``{email, created, raw_token}``.
    Already-active addresses do not get a repeat thank-you.
    """
    cleaned = normalize_email(email)
    if not is_valid_email(cleaned):
        raise ValueError("invalid_email")

    cur.execute(
        """
        SELECT id, status
          FROM blog_subscribers
         WHERE email = %(email)s
        """,
        {"email": cleaned},
    )
    row = cur.fetchone()
    if row is not None:
        status = str(row[1])
        if status == STATUS_ACTIVE:
            return {
                "email": cleaned,
                "created": False,
                "raw_token": None,
            }
        raw = _new_raw_token()
        cur.execute(
            """
            UPDATE blog_subscribers
               SET status = %(status)s,
                   unsubscribe_token_hash = %(token_hash)s,
                   unsubscribed_at = NULL
             WHERE email = %(email)s
            """,
            {
                "email": cleaned,
                "status": STATUS_ACTIVE,
                "token_hash": hash_token(raw),
            },
        )
        return {"email": cleaned, "created": True, "raw_token": raw}

    raw = _new_raw_token()
    cur.execute(
        """
        INSERT INTO blog_subscribers (
            email, status, unsubscribe_token_hash
        )
        VALUES (
            %(email)s, %(status)s, %(token_hash)s
        )
        """,
        {
            "email": cleaned,
            "status": STATUS_ACTIVE,
            "token_hash": hash_token(raw),
        },
    )
    return {"email": cleaned, "created": True, "raw_token": raw}


def list_unsub_token(email: str) -> str:
    return jwt.encode(
        {
            "purpose": JWT_PURPOSE_LIST,
            "email": normalize_email(email),
        },
        signing_secret(),
        algorithm=ALGORITHM,
    )


def blog_email_unsub_token(user_id: int) -> str:
    return jwt.encode(
        {
            "purpose": JWT_PURPOSE_ACCOUNT,
            "sub": str(user_id),
        },
        signing_secret(),
        algorithm=ALGORITHM,
    )


def _unsubscribe_list_email(cur, email: str) -> bool:
    """
    Hard-delete the mailing-list row.

    A valid token still succeeds when the row is already gone.
    """
    cleaned = normalize_email(email)
    if not is_valid_email(cleaned):
        return False
    cur.execute(
        """
        DELETE FROM blog_subscribers
         WHERE lower(email) = lower(%(email)s)
        """,
        {"email": cleaned},
    )
    return True


def _unsubscribe_account(cur, user_id: int) -> bool:
    cur.execute(
        """
        SELECT email, preferences
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    prefs_row = cur.fetchone()
    if prefs_row is None:
        return False
    email = str(prefs_row[0] or "")
    merged = merge_preference_patch(
        prefs_row[1],
        {"notify_blog_email": False},
    )
    cur.execute(
        """
        UPDATE users
           SET preferences = %(preferences)s,
               updated_at = NOW()
         WHERE id = %(user_id)s
        """,
        {
            "user_id": user_id,
            "preferences": Json(merged),
        },
    )
    if email:
        _unsubscribe_list_email(cur, email)
    return True


def unsubscribe_by_token(cur, raw_token: str) -> str:
    """
    Delete a mailing-list row, or turn off account blog email.

    Returns ``list`` or ``account``. Raises ValueError on bad token.
    """
    token = (raw_token or "").strip()
    if not token:
        raise ValueError("invalid_token")

    token_hash = hash_token(token)
    cur.execute(
        """
        DELETE FROM blog_subscribers
         WHERE unsubscribe_token_hash = %(token_hash)s
     RETURNING email
        """,
        {"token_hash": token_hash},
    )
    if cur.fetchone() is not None:
        return "list"

    try:
        payload = jwt.decode(
            token,
            signing_secret(),
            algorithms=[ALGORITHM],
        )
    except jwt.PyJWTError as exc:
        raise ValueError("invalid_token") from exc

    purpose = payload.get("purpose")
    if purpose == JWT_PURPOSE_LIST:
        email = normalize_email(str(payload.get("email") or ""))
        if not is_valid_email(email):
            raise ValueError("invalid_token")
        if not _unsubscribe_list_email(cur, email):
            raise ValueError("invalid_token")
        return "list"

    if purpose == JWT_PURPOSE_ACCOUNT:
        try:
            user_id = int(payload["sub"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("invalid_token") from exc
        if not _unsubscribe_account(cur, user_id):
            raise ValueError("invalid_token")
        return "account"

    raise ValueError("invalid_token")


def send_subscribe_thank_you(*, to: str, raw_token: str) -> None:
    unsub = _unsubscribe_url(raw_token)
    subject = "Thanks for subscribing to Mirror Image updates"
    text = (
        "Thanks for subscribing to Mirror Image blog updates.\n\n"
        f"Unsubscribe anytime: {unsub}\n"
    )
    html = _html_wrap(
        "You're on the list",
        "<p>Thanks for subscribing to Mirror Image blog updates.</p>"
        "<p>We'll email you when a new Updates post goes out.</p>"
        f"<p style='font-size:12px;color:#888'>"
        f"<a href=\"{unsub}\" style='color:#67e8f9'>Unsubscribe</a>"
        "</p>",
    )
    send_email(
        to=to,
        subject=subject,
        text_body=text,
        html_body=html,
        inline_images=_logo_inline(),
    )


_IMAGE_MD_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_LINK_MD_RE = re.compile(
    r"\[([^\]]+)\]\((https?://[^)\s]+)\)"
)
_BOLD_MD_RE = re.compile(r"\*\*(.+?)\*\*")
_ITALIC_MD_RE = re.compile(
    r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)"
)
_HEADING_MD_RE = re.compile(r"^(#{1,3})\s+(.+)$")
_LIST_ITEM_MD_RE = re.compile(r"^[-*]\s+(.+)$")

MAX_POST_CID_IMAGES = 8
MAX_POST_CID_BYTES = 1_048_576
MAX_POST_CID_TOTAL_BYTES = 4_194_304


def _strip_image_markdown(text: str) -> str:
    """Drop image refs; keep alt text when present."""
    return _IMAGE_MD_RE.sub(r"\1", text or "")


def build_post_cid_images(
    cur,
    markdown: str,
) -> tuple[dict[str, str], list[tuple[str, bytes, str]]]:
    """
    Load post images from disk for CID attach.

    Returns ``(token_to_cid, inline_parts)`` where each inline part is
    ``(cid, bytes, subtype)`` and token keys look like ``media:12``.
    """
    token_to_cid: dict[str, str] = {}
    inline_parts: list[tuple[str, bytes, str]] = []
    total_bytes = 0

    for kind, ref_id in extract_image_refs(markdown or ""):
        if len(inline_parts) >= MAX_POST_CID_IMAGES:
            break
        token = f"{kind}:{ref_id}"
        if token in token_to_cid:
            continue

        path: str | None = None
        if kind == "media":
            path = media_storage_key(cur, ref_id)
        elif kind == "card-art":
            path = card_image_path(cur, ref_id, "art")
        elif kind == "card-thumb":
            path = card_image_path(cur, ref_id, "thumb")
        if not path:
            continue

        key = storage_key(path)
        file_path = resolve_media_file(THUMBNAILS_DIR, key)
        if file_path is None:
            continue
        try:
            data = file_path.read_bytes()
        except OSError:
            logger.warning("email CID read failed for %s", key)
            continue
        if not data:
            continue
        if len(data) > MAX_POST_CID_BYTES:
            logger.info("email CID skip oversized %s", key)
            continue
        if total_bytes + len(data) > MAX_POST_CID_TOTAL_BYTES:
            break

        sniffed = sniff_image(data)
        if sniffed is None:
            continue
        _ext, mime = sniffed
        subtype = mime.split("/", 1)[1] if "/" in mime else "png"
        cid = f"post-img-{len(inline_parts)}@mirrorimage"
        token_to_cid[token] = cid
        inline_parts.append((cid, data, subtype))
        total_bytes += len(data)

    return token_to_cid, inline_parts


def _stash_cid_images(
    text: str,
    token_to_cid: dict[str, str],
    slots: list[str],
) -> str:
    def replace(match: re.Match[str]) -> str:
        alt = match.group(1)
        href = (match.group(2) or "").strip()
        parsed = parse_image_ref(href)
        if parsed is None:
            return alt or ""
        token = f"{parsed[0]}:{parsed[1]}"
        cid = token_to_cid.get(token)
        if cid is None:
            return alt or ""
        key = f"@@IMG{len(slots)}@@"
        safe_alt = html.escape(alt or "")
        slots.append(
            f'<img src="cid:{cid}" alt="{safe_alt}" '
            f'style="max-width:100%;height:auto;display:block;'
            f'margin:12px 0;border:0">'
        )
        return key

    return _IMAGE_MD_RE.sub(replace, text or "")


def _inline_markdown_to_html(
    text: str,
    *,
    token_to_cid: dict[str, str],
    image_slots: list[str],
) -> str:
    slot_start = len(image_slots)
    working = _stash_cid_images(text, token_to_cid, image_slots)
    links: list[tuple[str, str]] = []

    def stash_link(match: re.Match[str]) -> str:
        links.append((match.group(1), match.group(2).strip()))
        return f"@@LINK{len(links) - 1}@@"

    working = _LINK_MD_RE.sub(stash_link, working)
    working = html.escape(working)
    working = _BOLD_MD_RE.sub(r"<strong>\1</strong>", working)
    working = _ITALIC_MD_RE.sub(r"<em>\1</em>", working)
    for index, (label, href) in enumerate(links):
        safe_href = html.escape(href, quote=True)
        safe_label = html.escape(label)
        anchor = (
            f'<a href="{safe_href}" style="color:#67e8f9">'
            f"{safe_label}</a>"
        )
        working = working.replace(f"@@LINK{index}@@", anchor)
    for index in range(slot_start, len(image_slots)):
        working = working.replace(
            f"@@IMG{index}@@",
            image_slots[index],
        )
    return working


def markdown_body_to_email_html(
    markdown: str,
    token_to_cid: dict[str, str] | None = None,
) -> str:
    """
    Allowlisted markdown → email HTML.

    Known image tokens become CID ``<img>`` tags; unknown refs fall
    back to alt text. No raw HTML passes through.
    """
    cid_map = token_to_cid or {}
    raw = (markdown or "").strip()
    if not raw:
        return ""

    image_slots: list[str] = []
    blocks = re.split(r"\n\s*\n", raw)
    parts: list[str] = []
    for block in blocks:
        block = block.strip()
        if not block:
            continue

        heading = _HEADING_MD_RE.match(block)
        if heading is not None and "\n" not in block:
            level = min(len(heading.group(1)) + 1, 4)
            inner = _inline_markdown_to_html(
                heading.group(2),
                token_to_cid=cid_map,
                image_slots=image_slots,
            )
            parts.append(
                f"<h{level} style='margin:16px 0 8px;color:#e8e8e8'>"
                f"{inner}</h{level}>"
            )
            continue

        lines = block.split("\n")
        list_items: list[str] = []
        all_list = True
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            item = _LIST_ITEM_MD_RE.match(stripped)
            if item is None:
                all_list = False
                break
            item_html = _inline_markdown_to_html(
                item.group(1),
                token_to_cid=cid_map,
                image_slots=image_slots,
            )
            list_items.append(
                "<li style='margin:4px 0'>"
                f"{item_html}</li>"
            )
        if all_list and list_items:
            parts.append(
                "<ul style='padding-left:20px;margin:12px 0'>"
                f"{''.join(list_items)}</ul>"
            )
            continue

        joined = "<br>".join(
            _inline_markdown_to_html(
                line,
                token_to_cid=cid_map,
                image_slots=image_slots,
            )
            for line in lines
        )
        parts.append(f"<p style='margin:12px 0'>{joined}</p>")

    return "".join(parts)


def send_blog_post_email(
    *,
    to: str,
    title: str,
    slug: str,
    body_markdown: str,
    unsubscribe_url: str,
    include_post_link: bool = True,
    token_to_cid: dict[str, str] | None = None,
    post_inline_images: list[tuple[str, bytes, str]] | None = None,
) -> None:
    post_url = f"{_app_public_url()}/updates?slug={slug}"
    subject = f"Mirror Image update: {title}"
    body_text = _strip_image_markdown(body_markdown).strip()
    text_parts = [title, ""]
    if body_text:
        text_parts.extend([body_text, ""])
    if include_post_link:
        text_parts.extend([f"Read the post: {post_url}", ""])
    text_parts.extend(
        [
            f"Unsubscribe: {unsubscribe_url}",
            "",
        ]
    )
    text = "\n".join(text_parts)

    body_html = markdown_body_to_email_html(
        body_markdown,
        token_to_cid,
    )
    link_html = ""
    if include_post_link:
        link_html = (
            f"<p style='margin:20px 0 8px'>"
            f"<a href=\"{post_url}\" style='color:#67e8f9'>"
            "Read the post</a></p>"
        )
    html_body = _html_wrap(
        html.escape(title),
        f"{body_html}"
        f"{link_html}"
        f"<p style='font-size:12px;color:#888'>"
        f"<a href=\"{unsubscribe_url}\" style='color:#67e8f9'>"
        "Unsubscribe</a></p>",
    )
    inline_images = list(_logo_inline())
    if post_inline_images:
        inline_images.extend(post_inline_images)
    send_email(
        to=to,
        subject=subject,
        text_body=text,
        html_body=html_body,
        inline_images=inline_images or None,
    )


def collect_blog_email_recipients(cur) -> list[dict[str, Any]]:
    """Active mailing-list rows + users with notify_blog_email."""
    out: dict[str, dict[str, Any]] = {}

    cur.execute(
        """
        SELECT email
          FROM blog_subscribers
         WHERE status = %(status)s
        """,
        {"status": STATUS_ACTIVE},
    )
    for (email,) in cur.fetchall():
        cleaned = normalize_email(email)
        if not is_valid_email(cleaned):
            continue
        out[cleaned] = {
            "email": cleaned,
            "kind": "list",
        }

    cur.execute(
        """
        SELECT id, email, COALESCE(preferences, '{}'::jsonb)
          FROM users
         WHERE is_active IS TRUE
           AND email IS NOT NULL
           AND length(trim(email)) > 0
        """
    )
    for user_id, email, prefs in cur.fetchall():
        normalized = normalize_user_preferences(prefs)
        if not normalized.get("notify_blog_email"):
            continue
        cleaned = normalize_email(str(email))
        if not is_valid_email(cleaned):
            continue
        if cleaned in out:
            continue
        out[cleaned] = {
            "email": cleaned,
            "kind": "account",
            "user_id": int(user_id),
        }

    return list(out.values())


def fanout_blog_post_emails(
    cur,
    *,
    title: str,
    slug: str,
    body_markdown: str = "",
) -> dict[str, int]:
    """Send post emails. Returns ``{sent, failed}``."""
    recipients = collect_blog_email_recipients(cur)
    # /updates is gated while coming soon is on — omit dead site links.
    include_post_link = not coming_soon_or_false(cur)
    token_to_cid, post_images = build_post_cid_images(
        cur,
        body_markdown,
    )
    sent = 0
    failed = 0
    for item in recipients:
        email = item["email"]
        if item["kind"] == "list":
            unsub = _unsubscribe_url(list_unsub_token(email))
        else:
            unsub = _unsubscribe_url(
                blog_email_unsub_token(int(item["user_id"]))
            )
        try:
            send_blog_post_email(
                to=email,
                title=title,
                slug=slug,
                body_markdown=body_markdown,
                unsubscribe_url=unsub,
                include_post_link=include_post_link,
                token_to_cid=token_to_cid,
                post_inline_images=post_images,
            )
            sent += 1
        except EmailNotConfiguredError:
            logger.warning("blog fan-out skipped — email not configured")
            return {"sent": 0, "failed": len(recipients)}
        except Exception:
            logger.exception("blog fan-out failed for %s", email)
            failed += 1
    return {"sent": sent, "failed": failed}
