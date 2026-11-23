"""Postgres counters for login failures and outbound auth mail."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from psycopg2 import OperationalError

from app.db import get_connection

WINDOW = timedelta(seconds=600)
MAX_ATTEMPTS = 5

PURPOSE_LOGIN = "login"
PURPOSE_RESEND = "resend"
PURPOSE_RESET = "forgot"


def _normalize_key(key: str) -> str:
    return key.strip().lower()


def _bump(cur, purpose: str, key: str) -> bool:
    """
    Record one attempt. False when this attempt is past the limit.

    The first five attempts in a window are allowed. The sixth is not.
    """
    now = datetime.now(UTC)
    cur.execute(
        """
        SELECT window_started, attempt_count
          FROM auth_rate_limits
         WHERE purpose = %(purpose)s
           AND key = %(key)s
         FOR UPDATE
        """,
        {"purpose": purpose, "key": key},
    )
    row = cur.fetchone()
    if row is None:
        cur.execute(
            """
            INSERT INTO auth_rate_limits (
                purpose, key, window_started, attempt_count
            )
            VALUES (%(purpose)s, %(key)s, %(now)s, 1)
            """,
            {"purpose": purpose, "key": key, "now": now},
        )
        return True
    started = row[0]
    count = int(row[1])
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if now - started >= WINDOW:
        cur.execute(
            """
            UPDATE auth_rate_limits
               SET window_started = %(now)s,
                   attempt_count = 1
             WHERE purpose = %(purpose)s
               AND key = %(key)s
            """,
            {"purpose": purpose, "key": key, "now": now},
        )
        return True
    if count >= MAX_ATTEMPTS:
        return False
    cur.execute(
        """
        UPDATE auth_rate_limits
           SET attempt_count = attempt_count + 1
         WHERE purpose = %(purpose)s
           AND key = %(key)s
        """,
        {"purpose": purpose, "key": key},
    )
    return True


def is_limited(purpose: str, key: str) -> bool:
    """True when this key is already at the cap for the open window."""
    normalized = _normalize_key(key)
    if normalized == "":
        return False
    now = datetime.now(UTC)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT window_started, attempt_count
                      FROM auth_rate_limits
                     WHERE purpose = %(purpose)s
                       AND key = %(key)s
                    """,
                    {"purpose": purpose, "key": normalized},
                )
                row = cur.fetchone()
    except OperationalError:
        return False
    if row is None:
        return False
    started = row[0]
    if started.tzinfo is None:
        started = started.replace(tzinfo=UTC)
    if now - started >= WINDOW:
        return False
    return int(row[1]) >= MAX_ATTEMPTS


def allow_attempt(purpose: str, key: str) -> bool:
    """True when this attempt is still inside the window limit."""
    normalized = _normalize_key(key)
    if normalized == "":
        return True
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                allowed = _bump(cur, purpose, normalized)
            conn.commit()
    except OperationalError:
        return True
    return allowed


def clear_attempts(purpose: str, key: str) -> None:
    normalized = _normalize_key(key)
    if normalized == "":
        return
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM auth_rate_limits
                     WHERE purpose = %(purpose)s
                       AND key = %(key)s
                    """,
                    {"purpose": purpose, "key": normalized},
                )
            conn.commit()
    except OperationalError:
        return
