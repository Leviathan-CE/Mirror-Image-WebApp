"""Email token hash/consume helpers (no SMTP)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.email_tokens import (
    PURPOSE_VERIFY,
    consume_email_token,
    create_email_token,
    hash_token,
)
from app.db import get_connection


@pytest.fixture
def require_email_tables(require_db: None) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT to_regclass('public.email_tokens')
                """
            )
            if cur.fetchone()[0] is None:
                pytest.skip("email_tokens table missing — run migration 21")


def test_hash_token_stable():
    assert hash_token("abc") == hash_token("abc")
    assert hash_token("abc") != hash_token("abd")


def test_create_and_consume_token(require_email_tables: None, require_db: None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM users WHERE lower(email) = 'user@localhost' LIMIT 1"
            )
            row = cur.fetchone()
            if row is None:
                pytest.skip("seed user missing")
            user_id = int(row[0])
            raw = create_email_token(cur, user_id=user_id, purpose=PURPOSE_VERIFY)
            assert len(raw) > 10
            consumed = consume_email_token(
                cur, raw_token=raw, purpose=PURPOSE_VERIFY
            )
            assert consumed == user_id
            # single use
            assert (
                consume_email_token(cur, raw_token=raw, purpose=PURPOSE_VERIFY)
                is None
            )
        conn.commit()


def test_expired_token_rejected(require_email_tables: None, require_db: None):
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM users WHERE lower(email) = 'user@localhost' LIMIT 1"
            )
            row = cur.fetchone()
            if row is None:
                pytest.skip("seed user missing")
            user_id = int(row[0])
            raw = create_email_token(cur, user_id=user_id, purpose=PURPOSE_VERIFY)
            cur.execute(
                """
                UPDATE email_tokens
                   SET expires_at = %(exp)s
                 WHERE token_hash = %(hash)s
                """,
                {
                    "exp": datetime.now(UTC) - timedelta(minutes=1),
                    "hash": hash_token(raw),
                },
            )
            assert (
                consume_email_token(cur, raw_token=raw, purpose=PURPOSE_VERIFY)
                is None
            )
        conn.commit()
