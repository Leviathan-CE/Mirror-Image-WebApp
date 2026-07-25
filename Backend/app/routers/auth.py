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


class UserPublic(BaseModel):
    id: int
    user_name: str
    email: str
    role: str
    subscription_status: str = "none"
    subscription_type: str = ""
    is_subscribed: bool = False


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
    # Seconds until JWT expiry (handy for Unity session UI).
    expires_in: int | None = None


class RegisterResponse(BaseModel):
    id: int
    user_name: str
    email: str
    role: str
    subscription_status: str = "none"
    subscription_type: str = ""
    is_subscribed: bool = False
    access_token: str
    token_type: str = "bearer"


def _user_public_from_row(row: tuple) -> UserPublic:
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
    )


def _fetch_user_by_login(cur, identifier: str) -> tuple | None:
    sql = """
        SELECT id, user_name, email, password, role,
               subscription_status, subscription_type
        FROM users
        WHERE lower(email) = lower(%(id)s)
           OR lower(user_name) = lower(%(id)s)
        LIMIT 1
    """
    cur.execute(sql, {"id": identifier})
    return cur.fetchone()


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(body: RegisterRequest):
    """Create a new account and return a JWT."""
    password_hash = hash_password(body.password)
    email = str(body.email).lower()

    sql = """
        INSERT INTO users (user_name, email, password)
        VALUES (%(user_name)s, %(email)s, %(password)s)
        RETURNING id, user_name, email, role, subscription_status, subscription_type
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
            conn.commit()
    except UniqueViolation as e:
        logger.info("register conflict: %s", e)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="username_or_email_taken",
        ) from e
    except OperationalError as e:
        logger.warning("db error on register: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    public = _user_public_from_row(row)
    token = create_access_token(
        user_id=public.id,
        user_name=public.user_name,
        email=public.email,
        role=public.role,
    )
    return RegisterResponse(
        id=public.id,
        user_name=public.user_name,
        email=public.email,
        role=public.role,
        subscription_status=public.subscription_status,
        subscription_type=public.subscription_type,
        is_subscribed=public.is_subscribed,
        access_token=token,
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest):
    """Authenticate with email or username + password; return a JWT."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_by_login(cur, body.identifier)
    except OperationalError as e:
        logger.warning("db error on login: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        )

    user_id, user_name, email, password_hash, role, sub_status, sub_type = row
    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        )

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
        (user_id, user_name, email, role, sub_status or "none", sub_type or "")
    )
    expires_in = (
        UNITY_TOKEN_EXPIRE_MINUTES * 60
        if (body.client or "").strip().lower() == "unity"
        else None
    )
    return AuthResponse(access_token=token, user=public, expires_in=expires_in)


@router.get("/me", response_model=UserPublic)
def me(user_id: int = Depends(get_current_user_id)):
    """Return the current user from the Bearer token."""
    sql = """
        SELECT id, user_name, email, role, subscription_status, subscription_type
        FROM users
        WHERE id = %(user_id)s
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, {"user_id": user_id})
                row = cur.fetchone()
    except OperationalError as e:
        logger.warning("db error on /me: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="user_not_found",
        )
    return _user_public_from_row(row)
