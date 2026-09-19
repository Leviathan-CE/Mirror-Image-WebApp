"""Email one-time codes for login and Settings enable/disable."""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from app.mailer import EmailNotConfiguredError, send_email, smtp_config

logger = logging.getLogger(__name__)

TwoFactorMethod = Literal["email"]
TwoFactorPurpose = Literal["login", "enable", "disable"]

CODE_TTL = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
METHODS = frozenset({"email"})
PURPOSES = frozenset({"login", "enable", "disable"})


class TwoFactorError(ValueError):
    """Mapped to an HTTP detail by the router."""


@dataclass(frozen=True)
class TwoFactorChallenge:
    challenge_id: str
    method: TwoFactorMethod
    dest_hint: str


def email_2fa_available() -> bool:
    try:
        smtp_config()
        return True
    except EmailNotConfiguredError:
        return False


def mask_email(email: str) -> str:
    value = (email or "").strip()
    if "@" not in value:
        return "****"
    local, _, domain = value.partition("@")
    if not local:
        return f"****@{domain}"
    visible = local[0]
    return f"{visible}***@{domain}"


def dest_hint(_method: str, *, email: str, phone: str | None = None) -> str:
    return mask_email(email)


def generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(challenge_id: str, code: str) -> str:
    material = f"{challenge_id}:{code.strip()}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def codes_match(challenge_id: str, code: str, stored_hash: str) -> bool:
    expected = hash_code(challenge_id, code)
    return hmac.compare_digest(expected, stored_hash)


def _method_or_raise(method: str) -> TwoFactorMethod:
    if (method or "").strip().lower() not in METHODS:
        raise TwoFactorError("invalid_2fa_method")
    return "email"


def _purpose_or_raise(purpose: str) -> TwoFactorPurpose:
    if purpose not in PURPOSES:
        raise TwoFactorError("invalid_2fa_purpose")
    return purpose  # type: ignore[return-value]


def _assert_resend_allowed(sent_at) -> None:
    if sent_at is None:
        return
    if sent_at.tzinfo is None:
        sent_at = sent_at.replace(tzinfo=UTC)
    if datetime.now(UTC) - sent_at < RESEND_COOLDOWN:
        raise TwoFactorError("2fa_rate_limited")


def _send_code(*, dest: str, user_name: str, code: str) -> None:
    text = (
        f"Hi {user_name},\n\n"
        f"Your Mirror Image code is {code}. It expires in 10 minutes.\n"
        "If you did not request this, ignore this message.\n"
    )
    html = (
        "<html><body style='font-family:sans-serif;line-height:1.5'>"
        f"<p>Hi {user_name},</p>"
        f"<p>Your Mirror Image code is <strong>{code}</strong>. "
        "It expires in 10 minutes.</p>"
        "</body></html>"
    )
    send_email(
        to=dest,
        subject="Your Mirror Image sign-in code",
        text_body=text,
        html_body=html,
    )


def create_challenge(
    cur,
    *,
    user_id: int,
    purpose: str,
    method: str,
    dest: str,
    dest_hint_text: str,
    user_name: str,
    last_sent_at,
) -> TwoFactorChallenge:
    """
    Insert a one-time code, email it, stamp users.two_factor_code_sent_at.

    Invalidates unused prior codes for the same user+purpose.
    """
    purpose_ok = _purpose_or_raise(purpose)
    method_ok = _method_or_raise("email")
    if not dest:
        raise TwoFactorError("2fa_destination_missing")
    _assert_resend_allowed(last_sent_at)

    cur.execute(
        """
        UPDATE two_factor_challenges
           SET used_at = COALESCE(used_at, NOW())
         WHERE user_id = %(user_id)s
           AND purpose = %(purpose)s
           AND used_at IS NULL
        """,
        {"user_id": user_id, "purpose": purpose_ok},
    )

    challenge_id = secrets.token_urlsafe(24)
    code = generate_code()
    cur.execute(
        """
        INSERT INTO two_factor_challenges (
            id, user_id, purpose, method, dest_hint, code_hash, expires_at
        )
        VALUES (
            %(id)s, %(user_id)s, %(purpose)s, %(method)s,
            %(dest_hint)s, %(code_hash)s, %(expires_at)s
        )
        """,
        {
            "id": challenge_id,
            "user_id": user_id,
            "purpose": purpose_ok,
            "method": method_ok,
            "dest_hint": dest_hint_text,
            "code_hash": hash_code(challenge_id, code),
            "expires_at": datetime.now(UTC) + CODE_TTL,
        },
    )
    try:
        _send_code(dest=dest, user_name=user_name, code=code)
    except EmailNotConfiguredError as exc:
        raise TwoFactorError("email_not_configured") from exc
    except Exception as exc:
        logger.warning("2fa send failed: %s", exc)
        raise TwoFactorError("2fa_send_failed") from exc

    cur.execute(
        """
        UPDATE users
           SET two_factor_code_sent_at = NOW()
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    return TwoFactorChallenge(
        challenge_id=challenge_id,
        method=method_ok,
        dest_hint=dest_hint_text,
    )


def consume_challenge(
    cur,
    *,
    challenge_id: str,
    code: str,
    purpose: str,
    expected_user_id: int | None = None,
) -> int:
    """Mark the code used. Returns user_id. Raises TwoFactorError."""
    purpose_ok = _purpose_or_raise(purpose)
    raw_id = (challenge_id or "").strip()
    raw_code = (code or "").strip()
    if not raw_id or not raw_code:
        raise TwoFactorError("invalid_2fa_code")

    cur.execute(
        """
        SELECT user_id, code_hash, expires_at, used_at
          FROM two_factor_challenges
         WHERE id = %(id)s
           AND purpose = %(purpose)s
         LIMIT 1
        """,
        {"id": raw_id, "purpose": purpose_ok},
    )
    row = cur.fetchone()
    if row is None:
        raise TwoFactorError("invalid_2fa_code")

    user_id, stored_hash, expires_at, used_at = row
    if expected_user_id is not None and int(user_id) != int(expected_user_id):
        raise TwoFactorError("invalid_2fa_code")
    if used_at is not None:
        raise TwoFactorError("invalid_2fa_code")
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise TwoFactorError("invalid_2fa_code")
    if not codes_match(raw_id, raw_code, stored_hash):
        raise TwoFactorError("invalid_2fa_code")

    cur.execute(
        """
        UPDATE two_factor_challenges
           SET used_at = NOW()
         WHERE id = %(id)s
        """,
        {"id": raw_id},
    )
    return int(user_id)


def load_user_2fa(cur, user_id: int) -> tuple:
    """
    enabled, method, phone, email, user_name, sent_at, email_verified, password_hash
    """
    cur.execute(
        """
        SELECT two_factor_enabled,
               two_factor_method,
               phone_e164,
               email,
               user_name,
               two_factor_code_sent_at,
               email_verification_received,
               password
          FROM users
         WHERE id = %(user_id)s
         LIMIT 1
        """,
        {"user_id": user_id},
    )
    row = cur.fetchone()
    if row is None:
        raise TwoFactorError("user_not_found")
    return row


def enable_two_factor(
    cur,
    *,
    user_id: int,
    method: str = "email",
    phone: str | None = None,
) -> None:
    cur.execute(
        """
        UPDATE users
           SET two_factor_enabled = TRUE,
               two_factor_method = 'email',
               two_factor_verified_at = NOW()
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )


def disable_two_factor(cur, *, user_id: int) -> None:
    cur.execute(
        """
        UPDATE users
           SET two_factor_enabled = FALSE,
               two_factor_method = NULL,
               two_factor_verified_at = NULL
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )


def http_detail(exc: Exception) -> str:
    if isinstance(exc, TwoFactorError):
        return str(exc) or "invalid_2fa_code"
    return "2fa_send_failed"
