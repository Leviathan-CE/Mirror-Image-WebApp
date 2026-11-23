"""Account registration and login routes."""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import UniqueViolation

from app.account_delete import AccountDeleteError, purge_account
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
from app.profanity import reject_if_profane
from app.security import (
    UNITY_TOKEN_EXPIRE_MINUTES,
    SESSION_COOKIE_NAME,
    apply_session_cookie,
    clear_session_cookie,
    get_current_user_id,
    hash_password,
    verify_password,
)
from app.subscription import is_subscription_entitled
from app.user_preferences import (
    fetch_user_preferences,
    fetch_user_preferences_raw,
    merge_preference_patch,
    save_user_preferences,
)

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
    # "unity" returns the raw session id. Web clients omit this.
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


class UserPreferencesOut(BaseModel):
    deck_view: str = "cards"
    deck_sort: str = "type"
    deck_browse_width_px: int = 352
    library_sort: str = "name"
    library_page_size: int = 25
    library_preview_px: int = 112
    deck_start_sections: list[str] = Field(
        default_factory=lambda: ["Entity", "Cyberspell"]
    )
    deck_section_types: dict[str, list[str]] = Field(
        default_factory=lambda: {
            "entity": ["Entity"],
            "cyberspell": ["CyberSpell"],
        }
    )
    notify_blog: bool = True
    notify_cards: bool = True
    notify_blog_email: bool = False


class DeleteAccountBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    user_name: str = Field(min_length=1, max_length=32)


class UserPreferencesPatch(BaseModel):
    deck_view: str | None = None
    deck_sort: str | None = None
    deck_browse_width_px: int | None = None
    library_sort: str | None = None
    library_page_size: int | None = None
    library_preview_px: int | None = None
    deck_start_sections: list[str] | None = None
    deck_section_types: dict[str, list[str]] | None = None
    notify_blog: bool | None = None
    notify_cards: bool | None = None
    notify_blog_email: bool | None = None


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
    # Stored blob: {} until the user has saved prefs (client hydrates defaults).
    preferences: dict = Field(default_factory=dict)


class AuthResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user: UserPublic
    # Seconds until the Unity session expires. Omitted for the website.
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
    preferences: dict | None = None,
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
        preferences=preferences if isinstance(preferences, dict) else {},
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


def _features_for_user(
    cur,
    user_id: int,
    role: str,
    sub_status: str,
    sub_type: str = "",
) -> list[str]:
    granted = load_granted_feature_keys(cur, user_id)
    # Tier-specific keys (duplex on L2/L3) live on the offer catalog.
    from app.subscription import is_subscription_entitled
    from app.stripe_offers import offer_for_subscription_type_label

    if is_subscription_entitled(
        role=role,
        subscription_status=sub_status,
    ):
        offer = offer_for_subscription_type_label(sub_type or "")
        if offer is not None:
            granted = list({*granted, *offer.entitlements})

    catalog = [key for key, _label, _desc in load_feature_catalog(cur)]
    features = effective_feature_keys(
        role=role,
        subscription_status=sub_status,
        granted_keys=granted,
        catalog_keys=catalog,
    )
    # Site flag unlocks preview_cards for every logged-in account.
    from app.features import FEATURE_PREVIEW_CARDS
    from app.site_settings import previews_for_logged_in_or_false

    if (
        FEATURE_PREVIEW_CARDS not in features
        and previews_for_logged_in_or_false(cur)
    ):
        features = sorted({*features, FEATURE_PREVIEW_CARDS})
    return features


def _fail_login(login_key: str) -> None:
    from app.rate_limit import PURPOSE_LOGIN, allow_attempt

    if allow_attempt(PURPOSE_LOGIN, login_key):
        return
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="rate_limited",
    )


def _auth_response_for_user(
    response: Response,
    *,
    user_id: int,
    user_name: str,
    email: str,
    role: str,
    sub_status: str,
    sub_type: str,
    features: list[str],
    client: str = "",
    preferences: dict | None = None,
) -> AuthResponse:
    unity = (client or "").strip().lower() == "unity"
    from app.sessions import issue_session

    raw = issue_session(user_id, unity=unity)
    if not unity:
        apply_session_cookie(response, raw, unity=False)
    public = _user_public_from_row(
        (user_id, user_name, email, role, sub_status or "none", sub_type or ""),
        email_verified=True,
        features=features,
        preferences=preferences,
    )
    if unity:
        return AuthResponse(
            access_token=raw,
            user=public,
            expires_in=UNITY_TOKEN_EXPIRE_MINUTES * 60,
        )
    return AuthResponse(user=public)


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
    reject_if_profane(body.user_name, field="user_name")
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


@router.post(
    "/login",
    response_model=AuthResponse,
    response_model_exclude_none=True,
)
def login(body: LoginRequest, response: Response):
    """Authenticate with email or username + password."""
    from app.rate_limit import (
        PURPOSE_LOGIN,
        allow_attempt,
        clear_attempts,
        is_limited,
    )

    login_key = body.identifier.strip().lower()
    if is_limited(PURPOSE_LOGIN, login_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="rate_limited",
        )
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_by_login(cur, body.identifier)
                if row is None:
                    _fail_login(login_key)
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
                    _fail_login(login_key)
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
                    cur,
                    int(user_id),
                    role,
                    sub_status or "none",
                    sub_type or "",
                )
                prefs = fetch_user_preferences_raw(cur, int(user_id))
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on login: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    clear_attempts(PURPOSE_LOGIN, login_key)
    return _auth_response_for_user(
        response,
        user_id=int(user_id),
        user_name=user_name,
        email=email,
        role=role,
        sub_status=sub_status or "none",
        sub_type=sub_type or "",
        features=features,
        client=body.client,
        preferences=prefs,
    )


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


@router.post(
    "/google",
    response_model=AuthResponse,
    response_model_exclude_none=True,
)
def login_with_google(body: GoogleLoginRequest, response: Response):
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
                    resolved.subscription_type or "",
                )
                prefs = fetch_user_preferences_raw(cur, int(resolved.user_id))
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
        response,
        user_id=int(resolved.user_id),
        user_name=resolved.user_name or "",
        email=resolved.email or claims.email,
        role=resolved.role or "user",
        sub_status=resolved.subscription_status or "none",
        sub_type=resolved.subscription_type or "",
        features=features,
        client=body.client,
        preferences=prefs,
    )


@router.post(
    "/google/link-with-password",
    response_model=AuthResponse,
    response_model_exclude_none=True,
)
def link_google_account_with_password(
    body: GoogleLinkWithPasswordRequest,
    response: Response,
):
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
                    resolved.subscription_type or "",
                )
                prefs = fetch_user_preferences_raw(cur, int(resolved.user_id))
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
        response,
        user_id=int(resolved.user_id),
        user_name=resolved.user_name or "",
        email=resolved.email or claims.email,
        role=resolved.role or "user",
        sub_status=resolved.subscription_status or "none",
        sub_type=resolved.subscription_type or "",
        features=features,
        client=body.client,
        preferences=prefs,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response):
    """Delete this session row and clear the cookie."""
    from app.sessions import revoke_presented_session

    raw = request.cookies.get(SESSION_COOKIE_NAME)
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        raw = header.split(None, 1)[1].strip()
    revoke_presented_session(raw)
    clear_session_cookie(response)
    return None


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
                    cur,
                    int(row[0]),
                    row[3],
                    row[4] or "none",
                    row[5] or "",
                )
                prefs = fetch_user_preferences_raw(cur, int(row[0]))
                public = _user_public_from_row(
                    row[:6],
                    email_verified=bool(row[6]),
                    features=features,
                    preferences=prefs,
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


@router.patch("/me/preferences", response_model=UserPreferencesOut)
def patch_my_preferences(
    body: UserPreferencesPatch,
    user_id: int = Depends(get_current_user_id),
):
    """Merge allowlisted UI prefs onto the current account."""
    patch = body.model_dump(exclude_unset=True)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                current = fetch_user_preferences(cur, user_id)
                merged = merge_preference_patch(current, patch)
                saved = save_user_preferences(cur, user_id, merged)
            conn.commit()
    except OperationalError as e:
        logger.warning("db error on /me/preferences: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    return UserPreferencesOut(**saved)


@router.get("/me/export")
def export_my_account(user_id: int = Depends(get_current_user_id)):
    """Account personal information. No card numbers and no password hash."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT user_name, email, role, is_active,
                           subscription_status, subscription_type,
                           subscription_current_period_end,
                           subscription_cancel_at_period_end,
                           email_verification_received,
                           created_at, preferences
                      FROM users
                     WHERE id = %(user_id)s
                    """,
                    {"user_id": user_id},
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="user_not_found",
                    )
                cur.execute(
                    """
                    SELECT provider, email_at_link, linked_at
                      FROM user_oauth_identities
                     WHERE user_id = %(user_id)s
                     ORDER BY provider
                    """,
                    {"user_id": user_id},
                )
                oauth_rows = cur.fetchall()
    except HTTPException:
        raise
    except OperationalError as exc:
        logger.warning("db error on /me/export: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from exc

    period_end = row[6]
    created_at = row[9]
    return {
        "profile": {
            "user_name": row[0],
            "email": row[1],
            "role": row[2],
            "is_active": bool(row[3]),
            "email_verified": bool(row[8]),
            "created_at": created_at.isoformat() if created_at else None,
        },
        "preferences": row[10] if isinstance(row[10], dict) else {},
        "oauth_providers": [
            {
                "provider": item[0],
                "email_at_link": item[1],
                "linked_at": item[2].isoformat() if item[2] else None,
            }
            for item in oauth_rows
        ],
        "subscription": {
            "status": row[4] or "none",
            "type": row[5] or "",
            "current_period_end": (
                period_end.isoformat() if period_end else None
            ),
            "cancel_at_period_end": bool(row[7]),
        },
    }


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_account(
    body: DeleteAccountBody,
    response: Response,
    user_id: int = Depends(get_current_user_id),
):
    """Cancel Stripe, delete owned decks, then remove this user."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                purge_account(
                    cur, user_id=user_id, typed_username=body.user_name
                )
            conn.commit()
        clear_session_cookie(response)
    except AccountDeleteError as e:
        code = 400
        if e.detail == "user_not_found":
            code = 401
        if e.detail == "stripe_cancel_failed":
            code = 502
        raise HTTPException(status_code=code, detail=e.detail) from e
    except OperationalError as e:
        logger.warning("db error on delete /me: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

