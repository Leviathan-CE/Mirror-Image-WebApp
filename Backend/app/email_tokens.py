"""Email token create/consume + outbound template sends (one module for all purposes)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import urlencode

from app.mailer import EmailNotConfiguredError, send_email
from app.settings import frontend_url

PURPOSE_VERIFY = "verify_email"
PURPOSE_RESET = "password_reset"
PURPOSE_INVITE = "invite"

TOKEN_TTL = {
    PURPOSE_VERIFY: timedelta(hours=48),
    PURPOSE_RESET: timedelta(hours=2),
    PURPOSE_INVITE: timedelta(days=7),
}


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _app_public_url() -> str:
    """Public site origin for email links (APP_PUBLIC_URL or FRONTEND_URL)."""
    import os

    return (
        (os.environ.get("APP_PUBLIC_URL") or "").strip().rstrip("/")
        or frontend_url()
    )


def _link(path: str, token: str) -> str:
    base = _app_public_url()
    query = urlencode({"token": token})
    return f"{base}{path}?{query}"


def create_email_token(
    cur,
    *,
    user_id: int,
    purpose: str,
) -> str:
    """
    Insert a single-use token row; return the raw token (email only).

    Invalidates unused prior tokens for the same user+purpose.
    """
    if purpose not in TOKEN_TTL:
        raise ValueError("invalid_email_token_purpose")
    cur.execute(
        """
        UPDATE email_tokens
           SET used_at = COALESCE(used_at, NOW())
         WHERE user_id = %(user_id)s
           AND purpose = %(purpose)s
           AND used_at IS NULL
        """,
        {"user_id": user_id, "purpose": purpose},
    )
    raw = secrets.token_urlsafe(32)
    cur.execute(
        """
        INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
        VALUES (
            %(user_id)s,
            %(purpose)s,
            %(token_hash)s,
            %(expires_at)s
        )
        """,
        {
            "user_id": user_id,
            "purpose": purpose,
            "token_hash": hash_token(raw),
            "expires_at": datetime.now(UTC) + TOKEN_TTL[purpose],
        },
    )
    return raw


def consume_email_token(
    cur,
    *,
    raw_token: str,
    purpose: str,
) -> int | None:
    """
    Mark token used if valid. Returns user_id or None when invalid/expired/used.
    """
    if purpose not in TOKEN_TTL:
        return None
    cur.execute(
        """
        SELECT id, user_id, expires_at, used_at
          FROM email_tokens
         WHERE token_hash = %(token_hash)s
           AND purpose = %(purpose)s
         LIMIT 1
        """,
        {"token_hash": hash_token(raw_token), "purpose": purpose},
    )
    row = cur.fetchone()
    if row is None:
        return None
    token_id, user_id, expires_at, used_at = row
    if used_at is not None:
        return None
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        return None
    cur.execute(
        """
        UPDATE email_tokens
           SET used_at = NOW()
         WHERE id = %(id)s
           AND used_at IS NULL
        """,
        {"id": token_id},
    )
    if cur.rowcount != 1:
        return None
    return int(user_id)


def mark_email_verified(cur, user_id: int) -> None:
    cur.execute(
        """
        UPDATE users
           SET email_verification_received = TRUE,
               email_verified_at = NOW(),
               email_verification_sent = TRUE,
               email_verification_sent_at = COALESCE(email_verification_sent_at, NOW()),
               updated_at = NOW()
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )


def mark_verification_sent(cur, user_id: int) -> None:
    cur.execute(
        """
        UPDATE users
           SET email_verification_sent = TRUE,
               email_verification_sent_at = NOW(),
               updated_at = NOW()
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )


def _html_wrap(title: str, body_html: str) -> str:
    return (
        f"<html><body style='font-family:sans-serif;line-height:1.5'>"
        f"<h2>{title}</h2>{body_html}"
        f"<p style='color:#666;font-size:12px'>Mirror Image</p>"
        f"</body></html>"
    )


def send_verify_email(*, to: str, user_name: str, raw_token: str) -> None:
    link = _link("/verify-email", raw_token)
    subject = "Verify your Mirror Image email"
    text = (
        f"Hi {user_name},\n\n"
        f"Verify your email to sign in:\n{link}\n\n"
        "If you did not create this account, ignore this message.\n"
    )
    html = _html_wrap(
        "Verify your email",
        f"<p>Hi {user_name},</p>"
        f"<p><a href=\"{link}\">Verify your email</a> to sign in.</p>"
        f"<p>Or open: {link}</p>",
    )
    send_email(to=to, subject=subject, text_body=text, html_body=html)


def send_reset_email(*, to: str, user_name: str, raw_token: str) -> None:
    link = _link("/reset-password", raw_token)
    subject = "Reset your Mirror Image password"
    text = (
        f"Hi {user_name},\n\n"
        f"Reset your password:\n{link}\n\n"
        "If you did not request this, ignore this message.\n"
    )
    html = _html_wrap(
        "Reset your password",
        f"<p>Hi {user_name},</p>"
        f"<p><a href=\"{link}\">Reset your password</a>.</p>"
        f"<p>Or open: {link}</p>",
    )
    send_email(to=to, subject=subject, text_body=text, html_body=html)


def send_invite_email(*, to: str, user_name: str, raw_token: str) -> None:
    link = _link("/accept-invite", raw_token)
    subject = "You're invited to Mirror Image"
    text = (
        f"Hi {user_name},\n\n"
        f"Accept your invite and set a password:\n{link}\n\n"
    )
    html = _html_wrap(
        "You're invited",
        f"<p>Hi {user_name},</p>"
        f"<p><a href=\"{link}\">Accept invite</a> and set your password.</p>"
        f"<p>Or open: {link}</p>",
    )
    send_email(to=to, subject=subject, text_body=text, html_body=html)


def issue_and_send_verify(cur, *, user_id: int, email: str, user_name: str) -> None:
    raw = create_email_token(cur, user_id=user_id, purpose=PURPOSE_VERIFY)
    send_verify_email(to=email, user_name=user_name, raw_token=raw)
    mark_verification_sent(cur, user_id)


def issue_and_send_reset(cur, *, user_id: int, email: str, user_name: str) -> None:
    raw = create_email_token(cur, user_id=user_id, purpose=PURPOSE_RESET)
    send_reset_email(to=email, user_name=user_name, raw_token=raw)


def issue_and_send_invite(cur, *, user_id: int, email: str, user_name: str) -> None:
    raw = create_email_token(cur, user_id=user_id, purpose=PURPOSE_INVITE)
    send_invite_email(to=email, user_name=user_name, raw_token=raw)
    mark_verification_sent(cur, user_id)


def email_http_error(exc: Exception) -> dict[str, Any]:
    """Map mailer errors to FastAPI detail + status."""
    if isinstance(exc, EmailNotConfiguredError):
        return {"status_code": 503, "detail": "email_not_configured"}
    return {"status_code": 502, "detail": "email_send_failed"}
