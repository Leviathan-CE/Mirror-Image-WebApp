"""Email verification, invite accept, and password reset routes."""

from __future__ import annotations

import logging
import re
import time
from collections import defaultdict

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import UniqueViolation

from app.db import get_connection
from app.email_tokens import (
    PURPOSE_INVITE,
    PURPOSE_RESET,
    PURPOSE_VERIFY,
    consume_email_token,
    email_http_error,
    issue_and_send_reset,
    issue_and_send_verify,
    mark_email_verified,
)
from app.security import hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/email", tags=["email-auth"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,32}$")

# Simple in-memory rate limit: email → timestamps (per process).
_RATE_BUCKETS: dict[str, list[float]] = defaultdict(list)
_RATE_WINDOW_S = 600
_RATE_MAX = 5


def _rate_allow(key: str) -> bool:
    now = time.monotonic()
    bucket = _RATE_BUCKETS[key]
    _RATE_BUCKETS[key] = [t for t in bucket if now - t < _RATE_WINDOW_S]
    if len(_RATE_BUCKETS[key]) >= _RATE_MAX:
        return False
    _RATE_BUCKETS[key].append(now)
    return True


class TokenBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    token: str = Field(min_length=10, max_length=200)


class EmailBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr


class ResetPasswordBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class AcceptInviteBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    user_name: str | None = Field(default=None, min_length=3, max_length=32)

    @field_validator("user_name")
    @classmethod
    def _valid_username(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        if not _USERNAME_RE.fullmatch(value):
            raise ValueError(
                "user_name must be 3–32 chars: letters, numbers, underscore only"
            )
        return value


class OkResponse(BaseModel):
    ok: bool = True


@router.post("/verify", response_model=OkResponse)
def verify_email(body: TokenBody):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                user_id = consume_email_token(
                    cur, raw_token=body.token, purpose=PURPOSE_VERIFY
                )
                if user_id is None:
                    raise HTTPException(
                        status_code=400, detail="invalid_or_expired_token"
                    )
                mark_email_verified(cur, user_id)
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on verify email: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return OkResponse()


@router.post("/resend-verification", response_model=OkResponse)
def resend_verification(body: EmailBody):
    email = str(body.email).lower()
    if not _rate_allow(f"resend:{email}"):
        raise HTTPException(status_code=429, detail="rate_limited")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_name, email_verification_received, is_active
                      FROM users
                     WHERE lower(email) = %(email)s
                     LIMIT 1
                    """,
                    {"email": email},
                )
                row = cur.fetchone()
                # Always generic success when possible (no account enumeration).
                if row and row[3] and not row[2]:
                    try:
                        issue_and_send_verify(
                            cur,
                            user_id=int(row[0]),
                            email=email,
                            user_name=row[1],
                        )
                    except Exception as e:
                        conn.rollback()
                        mapped = email_http_error(e)
                        raise HTTPException(
                            status_code=mapped["status_code"],
                            detail=mapped["detail"],
                        ) from e
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on resend verification: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return OkResponse()


@router.post("/forgot-password", response_model=OkResponse)
def forgot_password(body: EmailBody):
    email = str(body.email).lower()
    if not _rate_allow(f"forgot:{email}"):
        raise HTTPException(status_code=429, detail="rate_limited")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, user_name, is_active, email_verification_received
                      FROM users
                     WHERE lower(email) = %(email)s
                     LIMIT 1
                    """,
                    {"email": email},
                )
                row = cur.fetchone()
                if row and row[2] and row[3]:
                    try:
                        issue_and_send_reset(
                            cur,
                            user_id=int(row[0]),
                            email=email,
                            user_name=row[1],
                        )
                    except Exception as e:
                        conn.rollback()
                        mapped = email_http_error(e)
                        raise HTTPException(
                            status_code=mapped["status_code"],
                            detail=mapped["detail"],
                        ) from e
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on forgot password: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return OkResponse()


@router.post("/reset-password", response_model=OkResponse)
def reset_password(body: ResetPasswordBody):
    password_hash = hash_password(body.password)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                user_id = consume_email_token(
                    cur, raw_token=body.token, purpose=PURPOSE_RESET
                )
                if user_id is None:
                    raise HTTPException(
                        status_code=400, detail="invalid_or_expired_token"
                    )
                cur.execute(
                    """
                    UPDATE users
                       SET password = %(password)s,
                           updated_at = NOW()
                     WHERE id = %(id)s
                       AND is_active = TRUE
                    """,
                    {"password": password_hash, "id": user_id},
                )
                if cur.rowcount != 1:
                    raise HTTPException(status_code=400, detail="invalid_or_expired_token")
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on reset password: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return OkResponse()


@router.post("/accept-invite", response_model=OkResponse)
def accept_invite(body: AcceptInviteBody):
    password_hash = hash_password(body.password)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                user_id = consume_email_token(
                    cur, raw_token=body.token, purpose=PURPOSE_INVITE
                )
                if user_id is None:
                    raise HTTPException(
                        status_code=400, detail="invalid_or_expired_token"
                    )
                if body.user_name:
                    cur.execute(
                        """
                        UPDATE users
                           SET password = %(password)s,
                               user_name = %(user_name)s,
                               updated_at = NOW()
                         WHERE id = %(id)s
                           AND is_active = TRUE
                        """,
                        {
                            "password": password_hash,
                            "user_name": body.user_name,
                            "id": user_id,
                        },
                    )
                else:
                    cur.execute(
                        """
                        UPDATE users
                           SET password = %(password)s,
                               updated_at = NOW()
                         WHERE id = %(id)s
                           AND is_active = TRUE
                        """,
                        {"password": password_hash, "id": user_id},
                    )
                if cur.rowcount != 1:
                    raise HTTPException(
                        status_code=400, detail="invalid_or_expired_token"
                    )
                mark_email_verified(cur, user_id)
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(
            status_code=409, detail="username_or_email_taken"
        ) from e
    except HTTPException:
        raise
    except OperationalError as e:
        logger.warning("db error on accept invite: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return OkResponse()
