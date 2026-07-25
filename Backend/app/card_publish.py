"""Catalogue visibility helpers — publish gate for library / search / decks."""

from __future__ import annotations

from fastapi import Depends
from psycopg2 import OperationalError

from app.db import get_connection
from app.security import get_optional_is_admin, get_optional_user_id
from app.subscription import is_subscription_entitled

PUBLISHED_STATUS = "published"
PREVIEW_STATUS = "preview"

# SQL fragment: row in publish_cards with an allowed status.
# Pass the cards table/alias that exposes `.id` (e.g. "cards", "c").
SQL_CARD_HAS_PUBLISH_STATUS = """
EXISTS (
    SELECT 1
      FROM publish_cards pc
     WHERE pc.card_id = {alias}.id
       AND pc.published IN ({statuses})
)
""".strip()


def sql_card_is_published(alias: str = "cards") -> str:
    """Return an EXISTS predicate for published-only catalogue visibility."""
    return SQL_CARD_HAS_PUBLISH_STATUS.format(
        alias=alias,
        statuses=f"'{PUBLISHED_STATUS}'",
    )


def sql_card_is_published_or_preview(alias: str = "cards") -> str:
    """Published + preview (subscriber entitlement)."""
    return SQL_CARD_HAS_PUBLISH_STATUS.format(
        alias=alias,
        statuses=f"'{PUBLISHED_STATUS}', '{PREVIEW_STATUS}'",
    )


def catalogue_visibility_sql(
    alias: str = "cards",
    *,
    bypass: bool = False,
    include_preview: bool = False,
) -> str:
    """
    Publish gate for public/user catalogue queries.

    - ``bypass=True`` (admins): all cards visible.
    - ``include_preview=True`` (subscribers): published + preview.
    - otherwise: published only.
    """
    if bypass:
        return "TRUE"
    if include_preview:
        return sql_card_is_published_or_preview(alias)
    return sql_card_is_published(alias)


def get_optional_include_preview(
    user_id: int | None = Depends(get_optional_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
) -> bool:
    """
    True when the caller is entitled to see preview-status cards.

    Admins use ``bypass`` instead; this stays False for them so SQL stays simple.
    Looks up live ``subscription_status`` (not JWT) so post-checkout sync works
    without re-login.
    """
    if is_admin or user_id is None:
        return False

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT role, subscription_status
                      FROM users
                     WHERE id = %(user_id)s
                    """,
                    {"user_id": user_id},
                )
                row = cur.fetchone()
    except OperationalError:
        return False

    if row is None:
        return False

    role = row[0] or "user"
    sub_status = row[1] or "none"
    return is_subscription_entitled(role=role, subscription_status=sub_status)
