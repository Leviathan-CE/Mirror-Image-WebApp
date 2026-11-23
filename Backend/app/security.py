"""Password hashing and JWT helpers for auth routes."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.roles import is_admin_role, is_staff_role

_bearer = HTTPBearer(auto_error=False)
SESSION_COOKIE_NAME = "mi_session"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.environ.get("JWT_EXPIRE_HOURS", "168"))  # 7 days
# Short-lived tokens for Unity / tooling clients (login body client="unity").
UNITY_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_UNITY_EXPIRE_MINUTES", "10"))


DEV_SIGNING_SECRET = "dev-only-change-me-mirror-image"


def signing_secret() -> str:
    """HMAC secret for image URLs and one-purpose unsubscribe links."""
    secret = (os.environ.get("JWT_SECRET") or "").strip()
    if not secret:
        return DEV_SIGNING_SECRET
    return secret


def assert_production_secret() -> None:
    """Refuse to serve production traffic with a missing or example secret."""
    from app.settings import is_dev

    if is_dev():
        return
    secret = (os.environ.get("JWT_SECRET") or "").strip()
    if secret == "" or secret == DEV_SIGNING_SECRET:
        raise RuntimeError(
            "JWT_SECRET must be set to a unique value when APP_ENV is production"
        )


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(
    *,
    user_id: int,
    user_name: str,
    email: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a JWT. Default lifetime is JWT_EXPIRE_HOURS; pass expires_delta to override."""
    expire = datetime.now(UTC) + (
        expires_delta
        if expires_delta is not None
        else timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    # id + role only. Name and email stay in the user row, not the cookie.
    del user_name
    del email
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
        "iat": datetime.now(UTC),
    }
    return jwt.encode(payload, signing_secret(), algorithm=ALGORITHM)


def session_max_age_seconds(*, unity: bool = False) -> int:
    if unity:
        return UNITY_TOKEN_EXPIRE_MINUTES * 60
    return ACCESS_TOKEN_EXPIRE_HOURS * 3600


def session_cookie_secure() -> bool:
    from app.settings import is_dev

    return not is_dev()


def apply_session_cookie(
    response: Response,
    token: str,
    *,
    unity: bool = False,
) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=session_max_age_seconds(unity=unity),
        httponly=True,
        secure=session_cookie_secure(),
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=session_cookie_secure(),
        samesite="lax",
    )


def _cookie_token(request: Request | None) -> str | None:
    if request is None:
        return None
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not isinstance(raw, str):
        return None
    cleaned = raw.strip()
    if not cleaned:
        return None
    return cleaned


def _bearer_token(
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials is None:
        return None
    if credentials.scheme.lower() != "bearer":
        return None
    return credentials.credentials


def presented_session_token(
    request: Request | None,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    """
    Bearer when a client sends one, otherwise the session cookie.

    The site no longer puts the token in JavaScript. Unity and tests
    still send Authorization. A cookie must not hide that header.
    """
    bearer = _bearer_token(credentials)
    if bearer:
        return bearer
    return _cookie_token(request)


def user_id_from_access_token(token: str) -> int:
    payload = decode_access_token(token)
    try:
        return int(payload["sub"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token_subject",
        ) from exc


def role_from_access_token(token: str) -> str | None:
    payload = decode_access_token(token)
    role = payload.get("role")
    if isinstance(role, str):
        return role
    return None


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode a real login session token.

    Single-purpose email-link tokens (password reset, blog unsubscribe,
    etc.) are signed with this same secret but carry a ``purpose`` claim
    that a login access token never sets. Reject them here so a token
    meant only for one narrow, unauthenticated action (e.g. clicking an
    unsubscribe link) can never be replayed as a full Bearer session.
    """
    try:
        payload = jwt.decode(token, signing_secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token_expired",
        ) from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
        ) from e
    if "purpose" in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
        )
    return payload


def _presented_or_401(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    token = presented_session_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing_bearer_token",
        )
    return token


def _session_user_or_401(raw: str) -> tuple[int, str]:
    from app.sessions import require_session_user

    return require_session_user(raw)


def get_current_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    """Require a live session cookie or bearer id and return the user id."""
    raw = _presented_or_401(request, credentials)
    user_id, _role = _session_user_or_401(raw)
    return user_id


def get_optional_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int | None:
    """Return user id when a valid session is present; otherwise None."""
    token = presented_session_token(request, credentials)
    if not token:
        return None
    user_id, _role = _session_user_or_401(token)
    return user_id


def get_optional_is_admin(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> bool:
    """True when a valid session is staff (admin or developer)."""
    token = presented_session_token(request, credentials)
    if not token:
        return False
    _user_id, role = _session_user_or_401(token)
    return is_staff_role(role)


def _require_session_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> tuple[int, str | None]:
    raw = _presented_or_401(request, credentials)
    return _session_user_or_401(raw)


def get_current_admin_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    """Require a session with role ``admin`` (user management)."""
    user_id, role = _require_session_user(request, credentials)
    if not is_admin_role(role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin_required",
        )
    return user_id


def get_current_staff_user_id(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> int:
    """Require a session with role ``admin`` or ``developer``."""
    user_id, role = _require_session_user(request, credentials)
    if not is_staff_role(role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="staff_required",
        )
    return user_id
