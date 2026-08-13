"""Account registration and login routes."""

from __future__ import annotations

import logging
import re

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import UniqueViolation

from app.db import get_connection
from app.email_tokens import email_http_error, issue_and_send_verify
from app.features import (
    effective_feature_keys,
    load_feature_catalog,
    load_granted_feature_keys,
)
from app.google_oauth import (
    GoogleTokenError,
    google_client_id,
    google_oauth_configured,
    link_google_with_password,
    resolve_google_login,
    verify_google_id_token,
)
from app.security import (
    UNITY_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
)
from app.subscription import is_subscription_entitled

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_name: str = Field(min_length=3, max_length=32)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("user_name")
    @classmethod
    def _valid_username(cls, value: str) -> str:
        if not _USERNAME_RE.fullmatch(value):
            raise ValueError(
                "user_name must be 3–32 chars: letters, numbers, underscore only"
            )
        return value


class LoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    # Email or username
    identifier: str = Field(min_length=1, max_length=254)
    password: str = Field(min_length=1, max_length=128)
    # "unity" → short-lived JWT (see JWT_UNITY_EXPIRE_MINUTES). Web clients omit this.
    client: str = Field(default="", max_length=32)


class GoogleLoginRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id_token: str = Field(min_length=20, max_length=8192)
    client: str = Field(default="", max_length=32)


class GoogleLinkWithPasswordRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id_token: str = Field(min_length=20, max_length=8192)
    password: str = Field(min_length=1, max_length=128)
    client: str = Field(default="", max_length=32)


class UserPublic(BaseModel):
    id: int
    user_name: str
    email: str
    role: str
    subscription_status: str = "none"
    subscription_type: str = ""
    is_subscribed: bool = False
    email_verified: bool = False
    features: list[str] = Field(default_factory=list)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    # Seconds until JWT expiry (handy for Unity session UI).
    expires_in: int | None = None


class GoogleAuthConfig(BaseModel):
    """Public GIS client id (safe to expose — not the client secret)."""

    google_client_id: str | None = None
    enabled: bool = False


class RegisterResponse(BaseModel):
    id: int
    user_name: str
    email: str
    role: str
    message: str = "verification_email_sent"


def _user_public_from_row(
    row: tuple,
    *,
    email_verified: bool = False,
    features: list[str] | None = None,
) -> UserPublic:
    """
    Map a users SELECT row:
    id, user_name, email, role, subscription_status, subscription_type
    """
    role = row[3]
    sub_status = row[4] if len(row) > 4 and row[4] is not None else "none"
    sub_type = row[5] if len(row) > 5 and row[5] is not None else ""
    return UserPublic(
        id=row[0],
        user_name=row[1],
        email=row[2],
        role=role,
        subscription_status=sub_status,
        subscription_type=sub_type,
        is_subscribed=is_subscription_entitled(
            role=role, subscription_status=sub_status
        ),
        email_verified=email_verified,
        features=features or [],
    )


def _fetch_user_by_login(cur, identifier: str) -> tuple | None:
    sql = """
        SELECT id, user_name, email, password, role,
               subscription_status, subscription_type,
               is_active, email_verification_received
        FROM users
        WHERE lower(email) = lower(%(id)s)
           OR lower(user_name) = lower(%(id)s)
        LIMIT 1
    """
    cur.execute(sql, {"id": identifier})
    return cur.fetchone()


def _features_for_user(cur, user_id: int, role: str, sub_status: str) -> list[str]:
    granted = load_granted_feature_keys(cur, user_id)
    catalog = [key for key, _label, _desc in load_feature_catalog(cur)]
    return effective_feature_keys(
        role=role,
        subscription_status=sub_status,
        granted_keys=granted,
        catalog_keys=catalog,
    )


def _auth_response_for_user(
    *,
    user_id: int,
    user_name: str,
    email: str,
    role: str,
    sub_status: str,
    sub_type: str,
    features: list[str],
    client: str = "",
) -> AuthResponse:
    unity = (client or "").strip().lower() == "unity"
    token = create_access_token(
        user_id=user_id,
        user_name=user_name,
        email=email,
        role=role,
        expires_delta=(
            timedelta(minutes=UNITY_TOKEN_EXPIRE_MINUTES) if unity else None
        ),
    )
    public = _user_public_from_row(
        (user_id, user_name, email, role, sub_status or "none", sub_type or ""),
        email_verified=True,
        features=features,
    )
    expires_in = UNITY_TOKEN_EXPIRE_MINUTES * 60 if unity else None
    return AuthResponse(access_token=token, user=public, expires_in=expires_in)


def _http_for_google_token_error(exc: GoogleTokenError) -> HTTPException:
    detail = str(exc) or "invalid_google_token"
    if detail == "google_not_configured":
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google_not_configured",
        )
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail if detail in {
            "invalid_google_token",
            "google_email_unverified",
            "missing_token",
        } else "invalid_google_token",
    )


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(body: RegisterRequest):
    """Create a new account and send a verification email (no JWT until verified)."""
    password_hash = hash_password(body.password)
    email = str(body.email).lower()

    sql = """
        INSERT INTO users (user_name, email, password)
        VALUES (%(user_name)s, %(email)s, %(password)s)
        RETURNING id, user_name, email, role
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql,
                    {
                        "user_name": body.user_name,
                        "email": email,
                        "password": password_hash,
                    },
                )
                row = cur.fetchone()
                try:
                    issue_and_send_verify(
                        cur,
                        user_id=int(row[0]),
                        email=email,
                        user_name=body.user_name,
                    )
                except Exception as e:
                    conn.rollback()
                    mapped = email_http_error(e)
                    raise HTTPException(
                        status_code=mapped["status_code"],
                        detail=mapped["detail"],
                    ) from e
            conn.commit()
    except UniqueViolation as e:
        logger.info("register conflict: %s", e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="username_or_email_taken",
        ) from e
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on register: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    return RegisterResponse(
        id=row[0],
        user_name=row[1],
        email=row[2],
        role=row[3],
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    """Authenticate with email or username + password; return a JWT."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_by_login(cur, body.identifier)
                if row is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="invalid_credentials",
                    )

                (
                    user_id,
                    user_name,
                    email,
                    password_hash,
                    role,
                    sub_status,
                    sub_type,
                    is_active,
                    email_verified,
                ) = row
                if not password_hash or not verify_password(
                    body.password, password_hash
                ):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="invalid_credentials",
                    )
                if not is_active:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="account_disabled",
                    )
                if not email_verified:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="email_not_verified",
                    )
                features = _features_for_user(
                    cur, int(user_id), role, sub_status or "none"
                )
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on login: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    token = create_access_token(
        user_id=user_id,
        user_name=user_name,
        email=email,
        role=role,
        expires_delta=(
            timedelta(minutes=UNITY_TOKEN_EXPIRE_MINUTES)
            if (body.client or "").strip().lower() == "unity"
            else None
        ),
    )
    public = _user_public_from_row(
        (user_id, user_name, email, role, sub_status or "none", sub_type or ""),
        email_verified=True,
        features=features,
    )
    expires_in = (
        UNITY_TOKEN_EXPIRE_MINUTES * 60
        if (body.client or "").strip().lower() == "unity"
        else None
    )
    return AuthResponse(access_token=token, user=public, expires_in=expires_in)


@router.get("/google/config", response_model=GoogleAuthConfig)
def google_auth_config():
    """
    Public config for the Google button.

    The Web client id is not a secret (GIS embeds it in the browser).
    Reading it from the API means Docker only needs GOOGLE_CLIENT_ID on the
    api service — no Vite rebuild to flip the button on.
    """
    client_id = google_client_id() or None
    return GoogleAuthConfig(
        google_client_id=client_id,
        enabled=bool(client_id),
    )


@router.post("/google", response_model=AuthResponse)
def login_with_google(body: GoogleLoginRequest):
    """
    Sign in with a Google Identity Services ID token.

    If a *verified* password account already owns the email, returns 409
    `password_account_exists` — client must call /auth/google/link-with-password.
    """
    if not google_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google_not_configured",
        )

    try:
        claims = verify_google_id_token(body.id_token)
    except GoogleTokenError as exc:
        raise _http_for_google_token_error(exc) from exc

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    resolved = resolve_google_login(cur, claims)
                except PermissionError as exc:
                    detail = str(exc) or "account_disabled"
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=detail,
                    ) from exc

                if resolved.outcome == "needs_password_link":
                    conn.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="password_account_exists",
                    )

                features = _features_for_user(
                    cur,
                    int(resolved.user_id),
                    resolved.role or "user",
                    resolved.subscription_status or "none",
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on google login: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    return _auth_response_for_user(
        user_id=int(resolved.user_id),
        user_name=resolved.user_name or "",
        email=resolved.email or claims.email,
        role=resolved.role or "user",
        sub_status=resolved.subscription_status or "none",
        sub_type=resolved.subscription_type or "",
        features=features,
        client=body.client,
    )


@router.post("/google/link-with-password", response_model=AuthResponse)
def link_google_account_with_password(body: GoogleLinkWithPasswordRequest):
    """
    Security check: prove password ownership of the verified email account,
    then attach this Google identity and return a session JWT.
    """
    if not google_oauth_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google_not_configured",
        )

    try:
        claims = verify_google_id_token(body.id_token)
    except GoogleTokenError as exc:
        raise _http_for_google_token_error(exc) from exc

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                try:
                    resolved = link_google_with_password(
                        cur,
                        claims,
                        password=body.password,
                        verify_password=verify_password,
                    )
                except LookupError as exc:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="account_not_found",
                    ) from exc
                except PermissionError as exc:
                    detail = str(exc) or "invalid_credentials"
                    code = (
                        status.HTTP_401_UNAUTHORIZED
                        if detail == "invalid_credentials"
                        else status.HTTP_403_FORBIDDEN
                    )
                    raise HTTPException(status_code=code, detail=detail) from exc

                features = _features_for_user(
                    cur,
                    int(resolved.user_id),
                    resolved.role or "user",
                    resolved.subscription_status or "none",
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on google link: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    return _auth_response_for_user(
        user_id=int(resolved.user_id),
        user_name=resolved.user_name or "",
        email=resolved.email or claims.email,
        role=resolved.role or "user",
        sub_status=resolved.subscription_status or "none",
        sub_type=resolved.subscription_type or "",
        features=features,
        client=body.client,
    )


@router.get("/me", response_model=UserPublic)
def me(user_id: int = Depends(get_current_user_id)):
    """Return the current user from the Bearer token."""
    sql = """
        SELECT id, user_name, email, role, subscription_status, subscription_type,
               email_verification_received, is_active
        FROM users
        WHERE id = %(user_id)s
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, {"user_id": user_id})
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="user_not_found",
                    )
                if not row[7]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="account_disabled",
                    )
                features = _features_for_user(
                    cur, int(row[0]), row[3], row[4] or "none"
                )
                public = _user_public_from_row(
                    row[:6],
                    email_verified=bool(row[6]),
                    features=features,
                )
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on /me: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    return public
