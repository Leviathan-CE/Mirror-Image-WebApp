"""Opaque login sessions stored in user_sessions."""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from psycopg2 import OperationalError

from app.db import get_connection
from app.security import session_max_age_seconds


def hash_session(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def insert_session(cur, user_id: int, *, unity: bool = False) -> str:
    """Insert one session row and return the raw id. Caller commits."""
    raw = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(
        seconds=session_max_age_seconds(unity=unity)
    )
    cur.execute(
        """
        INSERT INTO user_sessions (user_id, token_hash, expires_at)
        VALUES (%(user_id)s, %(token_hash)s, %(expires_at)s)
        """,
        {
            "user_id": user_id,
            "token_hash": hash_session(raw),
            "expires_at": expires_at,
        },
    )
    return raw


def issue_session(user_id: int, *, unity: bool = False) -> str:
    """Insert a session and commit. Returns the raw id."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                raw = insert_session(cur, user_id, unity=unity)
            conn.commit()
    except OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from exc
    return raw


def delete_session(cur, raw: str) -> None:
    cleaned = raw.strip()
    if cleaned == "":
        return
    cur.execute(
        """
        DELETE FROM user_sessions
         WHERE token_hash = %(token_hash)s
        """,
        {"token_hash": hash_session(cleaned)},
    )


def delete_user_sessions(cur, user_id: int) -> None:
    cur.execute(
        """
        DELETE FROM user_sessions
         WHERE user_id = %(user_id)s
        """,
        {"user_id": user_id},
    )


def revoke_presented_session(raw: str | None) -> None:
    """Delete one session row. Missing or unknown ids are fine."""
    if raw is None or raw.strip() == "":
        return
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                delete_session(cur, raw)
            conn.commit()
    except OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from exc


def _load_row(raw: str) -> tuple | None:
    cleaned = raw.strip()
    if cleaned == "":
        return None
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.role, u.is_active
                  FROM user_sessions s
                  JOIN users u ON u.id = s.user_id
                 WHERE s.token_hash = %(token_hash)s
                   AND s.expires_at > NOW()
                """,
                {"token_hash": hash_session(cleaned)},
            )
            return cur.fetchone()


def require_session_user(raw: str) -> tuple[int, str]:
    """
    Return (user id, role) for a live active session.

    Missing, expired, and disabled sessions are 401.
    """
    try:
        row = _load_row(raw)
    except OperationalError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from exc
    if row is None or not bool(row[2]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_token",
        )
    role = row[1] if isinstance(row[1], str) else "user"
    return int(row[0]), role


def peek_session_user_id(raw: str | None) -> int | None:
    """Analytics lookup. Never raises."""
    if raw is None or raw.strip() == "":
        return None
    try:
        row = _load_row(raw)
    except Exception:
        return None
    if row is None or not bool(row[2]):
        return None
    return int(row[0])
