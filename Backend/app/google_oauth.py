"""Google Sign-In: verify ID tokens and map claims → app users.

Security policy (email collision):
- Match by Google `sub` first (stable identity).
- New email → create OAuth-only user (password NULL, email verified).
- Existing *unverified* password account with same email → claim it:
  Google proved inbox ownership; wipe the squatter's password.
- Existing *verified* password account → do NOT auto-link.
  Caller must prove the password via /auth/google/link-with-password.
"""

from __future__ import annotations

import logging
import os
import re
import secrets
from dataclasses import dataclass
from typing import Any, Literal

import jwt
from jwt import PyJWKClient

from app.profanity import contains_profanity

logger = logging.getLogger(__name__)

PROVIDER_GOOGLE = "google"
_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = (
    "accounts.google.com",
    "https://accounts.google.com",
)
_USERNAME_SANITIZE = re.compile(r"[^a-zA-Z0-9_]+")

_jwks_client: PyJWKClient | None = None


def google_client_id() -> str:
    return (os.environ.get("GOOGLE_CLIENT_ID") or "").strip()


def google_oauth_configured() -> bool:
    return bool(google_client_id())


@dataclass(frozen=True)
class GoogleIdClaims:
    sub: str
    email: str
    email_verified: bool


class GoogleTokenError(ValueError):
    """ID token failed verification or lacked required claims."""


def _jwks() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(_GOOGLE_JWKS_URL, cache_keys=True)
    return _jwks_client


def verify_google_id_token(id_token: str, *, audience: str | None = None) -> GoogleIdClaims:
    """
    Cryptographically verify a Google ID token (GIS `credential`).

    Raises GoogleTokenError on any failure.
    """
    token = (id_token or "").strip()
    if not token:
        raise GoogleTokenError("missing_token")

    aud = (audience or google_client_id()).strip()
    if not aud:
        raise GoogleTokenError("google_not_configured")

    try:
        key = _jwks().get_signing_key_from_jwt(token)
        payload: dict[str, Any] = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            audience=aud,
            issuer=_GOOGLE_ISSUERS,
            options={"require": ["exp", "iat", "sub", "email"]},
        )
    except GoogleTokenError:
        raise
    except Exception as exc:
        logger.info("google id token rejected: %s", exc)
        raise GoogleTokenError("invalid_google_token") from exc

    sub = str(payload.get("sub") or "").strip()
    email = str(payload.get("email") or "").strip().lower()
    verified_raw = payload.get("email_verified")
    email_verified = verified_raw is True or verified_raw == "true"

    if not sub or not email:
        raise GoogleTokenError("invalid_google_token")
    if not email_verified:
        raise GoogleTokenError("google_email_unverified")

    return GoogleIdClaims(sub=sub, email=email, email_verified=True)


def username_seed_from_email(email: str) -> str:
    local = email.split("@", 1)[0]
    cleaned = _USERNAME_SANITIZE.sub("_", local).strip("_")
    if len(cleaned) < 3:
        cleaned = (cleaned + "user")[:32]
    return cleaned[:32]


def allocate_unique_username(cur, email: str) -> str:
    """Pick a free username based on the email local-part."""
    base = username_seed_from_email(email)
    if contains_profanity(base):
        base = f"user_{secrets.token_hex(3)}"
    candidate = base
    for _ in range(12):
        if contains_profanity(candidate):
            candidate = f"user_{secrets.token_hex(4)}"
        cur.execute(
            """
            SELECT 1 FROM users WHERE lower(user_name) = lower(%(name)s) LIMIT 1
            """,
            {"name": candidate},
        )
        if cur.fetchone() is None:
            return candidate
        suffix = secrets.token_hex(2)
        candidate = f"{base[: 32 - len(suffix) - 1]}_{suffix}"
    return f"user_{secrets.token_hex(6)}"


Outcome = Literal[
    "login",
    "created",
    "claimed_unverified",
    "needs_password_link",
]


@dataclass(frozen=True)
class GoogleResolveResult:
    outcome: Outcome
    user_id: int | None = None
    user_name: str | None = None
    email: str | None = None
    role: str | None = None
    subscription_status: str | None = None
    subscription_type: str | None = None


def _fetch_user_row(cur, user_id: int) -> tuple | None:
    cur.execute(
        """
        SELECT id, user_name, email, role, subscription_status, subscription_type,
               is_active, email_verification_received, password
          FROM users
         WHERE id = %(id)s
        """,
        {"id": user_id},
    )
    return cur.fetchone()


def _fetch_user_by_email(cur, email: str) -> tuple | None:
    cur.execute(
        """
        SELECT id, user_name, email, role, subscription_status, subscription_type,
               is_active, email_verification_received, password
          FROM users
         WHERE lower(email) = lower(%(email)s)
         LIMIT 1
        """,
        {"email": email},
    )
    return cur.fetchone()


def _oauth_user_id(cur, subject: str) -> int | None:
    cur.execute(
        """
        SELECT user_id
          FROM user_oauth_identities
         WHERE provider = %(provider)s
           AND subject = %(subject)s
         LIMIT 1
        """,
        {"provider": PROVIDER_GOOGLE, "subject": subject},
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def _link_google(cur, *, user_id: int, subject: str, email: str) -> None:
    cur.execute(
        """
        INSERT INTO user_oauth_identities (user_id, provider, subject, email_at_link)
        VALUES (%(user_id)s, %(provider)s, %(subject)s, %(email)s)
        ON CONFLICT (provider, subject) DO NOTHING
        """,
        {
            "user_id": user_id,
            "provider": PROVIDER_GOOGLE,
            "subject": subject,
            "email": email,
        },
    )


def _result_from_row(row: tuple, outcome: Outcome) -> GoogleResolveResult:
    return GoogleResolveResult(
        outcome=outcome,
        user_id=int(row[0]),
        user_name=row[1],
        email=row[2],
        role=row[3],
        subscription_status=row[4] or "none",
        subscription_type=row[5] or "",
    )


def resolve_google_login(cur, claims: GoogleIdClaims) -> GoogleResolveResult:
    """
    Apply Google login policy against the DB (caller commits).

    Returns needs_password_link when a verified password account owns the email.
    """
    existing_oauth_uid = _oauth_user_id(cur, claims.sub)
    if existing_oauth_uid is not None:
        row = _fetch_user_row(cur, existing_oauth_uid)
        if row is None:
            raise RuntimeError("oauth_user_missing")
        if not row[6]:
            raise PermissionError("account_disabled")
        return _result_from_row(row, "login")

    row = _fetch_user_by_email(cur, claims.email)
    if row is None:
        user_name = allocate_unique_username(cur, claims.email)
        cur.execute(
            """
            INSERT INTO users (
                user_name, email, password,
                email_verification_sent, email_verification_received, email_verified_at
            )
            VALUES (
                %(user_name)s, %(email)s, NULL,
                TRUE, TRUE, NOW()
            )
            RETURNING id, user_name, email, role, subscription_status, subscription_type,
                      is_active, email_verification_received, password
            """,
            {"user_name": user_name, "email": claims.email},
        )
        created = cur.fetchone()
        _link_google(
            cur, user_id=int(created[0]), subject=claims.sub, email=claims.email
        )
        return _result_from_row(created, "created")

    if not row[6]:
        raise PermissionError("account_disabled")

    email_verified = bool(row[7])
    if not email_verified:
        # Squatter registered with this Google email but never verified.
        # Google ID token proves ownership → claim and wipe password.
        cur.execute(
            """
            UPDATE users
               SET password = NULL,
                   email_verification_sent = TRUE,
                   email_verification_received = TRUE,
                   email_verified_at = COALESCE(email_verified_at, NOW()),
                   updated_at = NOW()
             WHERE id = %(id)s
            """,
            {"id": int(row[0])},
        )
        _link_google(cur, user_id=int(row[0]), subject=claims.sub, email=claims.email)
        refreshed = _fetch_user_row(cur, int(row[0]))
        assert refreshed is not None
        return _result_from_row(refreshed, "claimed_unverified")

    # Verified password (or already-verified) account: require password to link.
    return GoogleResolveResult(
        outcome="needs_password_link",
        user_id=int(row[0]),
        user_name=row[1],
        email=row[2],
        role=row[3],
        subscription_status=row[4] or "none",
        subscription_type=row[5] or "",
    )


def link_google_with_password(
    cur,
    claims: GoogleIdClaims,
    *,
    password: str,
    verify_password,
) -> GoogleResolveResult:
    """
    Link Google to a verified email account after password check.

    `verify_password(plain, hash) -> bool` is injected for testability.
    """
    existing_oauth_uid = _oauth_user_id(cur, claims.sub)
    if existing_oauth_uid is not None:
        row = _fetch_user_row(cur, existing_oauth_uid)
        if row is None:
            raise RuntimeError("oauth_user_missing")
        if not row[6]:
            raise PermissionError("account_disabled")
        # Already linked — password not required again.
        return _result_from_row(row, "login")

    row = _fetch_user_by_email(cur, claims.email)
    if row is None:
        raise LookupError("account_not_found")
    if not row[6]:
        raise PermissionError("account_disabled")
    if not bool(row[7]):
        raise PermissionError("email_not_verified")

    password_hash = row[8]
    if not password_hash or not verify_password(password, password_hash):
        raise PermissionError("invalid_credentials")

    _link_google(cur, user_id=int(row[0]), subject=claims.sub, email=claims.email)
    return _result_from_row(row, "login")
