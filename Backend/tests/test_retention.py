"""Expired print grants are removed."""

import uuid

from app.db import get_connection
from app.retention import delete_expired_print_grants


def test_delete_expired_print_grants(require_db):
    marker = f"pi_test_{uuid.uuid4().hex}"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id
                  FROM users
                 ORDER BY id
                 LIMIT 1
                """
            )
            row = cur.fetchone()
            if row is None:
                return
            user_id = int(row[0])
            cur.execute(
                """
                INSERT INTO print_download_grants (
                    user_id, deck_id, payment_intent_id,
                    card_count, amount_cents, expires_at
                )
                VALUES (
                    %(user_id)s, 1, %(marker)s,
                    1, 100, NOW() - INTERVAL '2 days'
                )
                """,
                {"user_id": user_id, "marker": marker},
            )
            removed = delete_expired_print_grants(cur)
            assert removed >= 1
            cur.execute(
                """
                SELECT 1
                  FROM print_download_grants
                 WHERE payment_intent_id = %(marker)s
                """,
                {"marker": marker},
            )
            assert cur.fetchone() is None
        conn.commit()
