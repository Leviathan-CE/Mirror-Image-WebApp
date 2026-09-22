"""Announcement queries: slugs, covers, signed image maps."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.announcement_sanitize import (
    extract_image_refs,
    parse_youtube_id,
    sanitize_announcement_markdown,
    sanitize_title,
    slugify_title,
)
from app.media_urls import signed_media_path

THUMBNAILS_DIR = Path(__file__).resolve().parent / "thumbnails"
LIBRARY_DIR = THUMBNAILS_DIR / "announcements" / "library"

ANNOUNCEMENT_SELECT = """
    SELECT a.id, a.slug, a.title, a.body_markdown, a.status,
           a.cover_kind, a.cover_media_id, a.cover_card_id, a.cover_card_face,
           a.cover_youtube_id, a.published_at, a.created_at, a.updated_at,
           a.created_by, a.updated_by
      FROM announcements a
"""


def unique_slug(cur, title: str, *, exclude_id: int | None = None) -> str:
    base = slugify_title(title)
    slug = base
    n = 2
    while True:
        if exclude_id is None:
            cur.execute(
                "SELECT 1 FROM announcements WHERE slug = %(slug)s",
                {"slug": slug},
            )
        else:
            cur.execute(
                """
                SELECT 1 FROM announcements
                 WHERE slug = %(slug)s AND id <> %(id)s
                """,
                {"slug": slug, "id": exclude_id},
            )
        if cur.fetchone() is None:
            return slug
        slug = f"{base}-{n}"
        n += 1


def row_to_dict(row: tuple) -> dict[str, Any]:
    return {
        "id": int(row[0]),
        "slug": row[1],
        "title": row[2],
        "body_markdown": row[3] or "",
        "status": row[4],
        "cover_kind": row[5],
        "cover_media_id": int(row[6]) if row[6] is not None else None,
        "cover_card_id": int(row[7]) if row[7] is not None else None,
        "cover_card_face": row[8],
        "cover_youtube_id": row[9],
        "published_at": row[10],
        "created_at": row[11],
        "updated_at": row[12],
        "created_by": int(row[13]) if row[13] is not None else None,
        "updated_by": int(row[14]) if row[14] is not None else None,
    }


def card_image_path(cur, card_id: int, face: str) -> str | None:
    if card_id <= 0:
        return None
    column = (
        "illustration_thumbnail_path"
        if face == "art"
        else "card_thumbnail_path"
    )
    if column not in {
        "illustration_thumbnail_path",
        "card_thumbnail_path",
    }:
        return None
    cur.execute(
        f"SELECT {column} FROM cards WHERE id = %(card_id)s",
        {"card_id": card_id},
    )
    row = cur.fetchone()
    if row is None or not row[0]:
        return None
    return str(row[0])


def media_storage_key(cur, media_id: int) -> str | None:
    if media_id <= 0:
        return None
    cur.execute(
        "SELECT storage_key FROM announcement_media WHERE id = %(id)s",
        {"id": media_id},
    )
    row = cur.fetchone()
    if row is None or not row[0]:
        return None
    return str(row[0])


def resolve_cover(cur, post: dict[str, Any]) -> dict[str, Any]:
    kind = post.get("cover_kind") or "image"
    youtube_id = post.get("cover_youtube_id")
    image_url = None
    if kind == "youtube" and youtube_id:
        image_url = f"https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg"
    elif kind == "image" and post.get("cover_media_id"):
        key = media_storage_key(cur, int(post["cover_media_id"]))
        image_url = signed_media_path(key)
    elif kind == "card" and post.get("cover_card_id"):
        face = post.get("cover_card_face") or "thumb"
        path = card_image_path(cur, int(post["cover_card_id"]), face)
        image_url = signed_media_path(path)
    return {
        "kind": kind,
        "image_url": image_url,
        "youtube_id": youtube_id if kind == "youtube" else None,
    }


def resolve_image_map(cur, markdown: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for kind, ref_id in extract_image_refs(markdown):
        token = f"{kind}:{ref_id}"
        path = None
        if kind == "media":
            path = media_storage_key(cur, ref_id)
        elif kind == "card-art":
            path = card_image_path(cur, ref_id, "art")
        elif kind == "card-thumb":
            path = card_image_path(cur, ref_id, "thumb")
        signed = signed_media_path(path)
        if signed:
            out[token] = signed
    return out


def apply_cover_fields(
    cur,
    *,
    cover_kind: str | None,
    cover_media_id: int | None,
    cover_card_id: int | None,
    cover_card_face: str | None,
    cover_youtube: str | None,
) -> dict[str, Any]:
    kind = (cover_kind or "image").strip().lower()
    if kind not in {"image", "youtube", "card"}:
        raise ValueError("invalid_cover_kind")
    media_id = cover_media_id
    card_id = cover_card_id
    face = cover_card_face if cover_card_face in {"art", "thumb"} else None
    youtube_id = parse_youtube_id(cover_youtube) if cover_youtube else None

    if kind == "youtube":
        if not youtube_id:
            raise ValueError("invalid_youtube")
        media_id = None
        card_id = None
        face = None
    elif kind == "image":
        if media_id is None:
            raise ValueError("cover_media_required")
        if media_storage_key(cur, int(media_id)) is None:
            raise ValueError("cover_media_not_found")
        card_id = None
        face = None
        youtube_id = None
    else:
        if card_id is None:
            raise ValueError("cover_card_required")
        if face is None:
            face = "thumb"
        if card_image_path(cur, int(card_id), face) is None:
            raise ValueError("cover_card_not_found")
        media_id = None
        youtube_id = None

    return {
        "cover_kind": kind,
        "cover_media_id": media_id,
        "cover_card_id": card_id,
        "cover_card_face": face,
        "cover_youtube_id": youtube_id,
    }


def public_payload(cur, post: dict[str, Any]) -> dict[str, Any]:
    body = sanitize_announcement_markdown(post["body_markdown"])
    return {
        "id": post["id"],
        "slug": post["slug"],
        "title": sanitize_title(post["title"]),
        "body_markdown": body,
        "status": post["status"],
        "published_at": post["published_at"],
        "created_at": post["created_at"],
        "updated_at": post["updated_at"],
        "cover": resolve_cover(cur, post),
        "images": resolve_image_map(cur, body),
    }
