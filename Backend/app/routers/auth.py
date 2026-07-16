"""Account registration and login routes."""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import UniqueViolation

from app.db import get_connection
from app.security import (
    create_access_token,
    get_current_user_id,
    hash_password,
    verify_password,
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


class UserPublic(BaseModel):
    id: int
    user_name: str
    email: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class RegisterResponse(BaseModel):
    id: int
    user_name: str
    email: str
    access_token: str
    token_type: str = "bearer"


def _fetch_user_by_login(cur, identifier: str) -> tuple | None:
    sql = """
        SELECT id, user_name, email, password
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
        RETURNING id, user_name, email
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

    user_id, user_name, user_email = row[0], row[1], row[2]
    token = create_access_token(
        user_id=user_id, user_name=user_name, email=user_email
    )
    return RegisterResponse(
        id=user_id,
        user_name=user_name,
        email=user_email,
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

    user_id, user_name, email, password_hash = row
    if not password_hash or not verify_password(body.password, password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
        )

    token = create_access_token(
        user_id=user_id, user_name=user_name, email=email
    )
    return AuthResponse(
        access_token=token,
        user=UserPublic(id=user_id, user_name=user_name, email=email),
    )


@router.get("/me", response_model=UserPublic)
def me(user_id: int = Depends(get_current_user_id)):
    """Return the current user from the Bearer token."""
    sql = """
        SELECT id, user_name, email, role
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
    return UserPublic(id=row[0], user_name=row[1], email=row[2])
