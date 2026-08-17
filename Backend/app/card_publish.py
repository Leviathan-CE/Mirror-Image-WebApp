"""Catalogue visibility helpers — publish gate for library / search / decks."""

from __future__ import annotations

from fastapi import Depends
from psycopg2 import OperationalError

from app.db import get_connection
from app.features import FEATURE_PREVIEW_CARDS, load_granted_feature_keys, user_has_feature
from app.security import get_optional_is_admin, get_optional_user_id

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
    Looks up live role / subscription / grants (not JWT).
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
                if row is None:
                    return False
                role = row[0] or "user"
                sub_status = row[1] or "none"
                granted = load_granted_feature_keys(cur, user_id)
    except OperationalError:
        return False

    return user_has_feature(
        role=role,
        subscription_status=sub_status,
        granted_keys=granted,
        feature_key=FEATURE_PREVIEW_CARDS,
    )


def should_classify_publish_status(
    published: str | None,
    *,
    bypass: bool = False,
    include_preview: bool = False,
) -> bool:
    """
    True when a deck card must be returned as a classified stub.

    - Admins (``bypass``): never classify.
    - ``published``: never classify.
    - ``preview`` + subscriber (``include_preview``): never classify.
    - Anything else (preview without sub, not published, missing row): classify.
    """
    return deck_card_classification(
        published, bypass=bypass, include_preview=include_preview
    ) is not None


def deck_card_classification(
    published: str | None,
    *,
    bypass: bool = False,
    include_preview: bool = False,
) -> str | None:
    """
    Redaction kind for a deck card, or ``None`` when the viewer sees full data.

    - ``classified`` — preview status, viewer not entitled (subscribe CTA).
    - ``top_secret`` — not published / missing publish row (coming soon).
    """
    if bypass:
        return None
    if published == PUBLISHED_STATUS:
        return None
    if published == PREVIEW_STATUS:
        return None if include_preview else "classified"
    return "top_secret"


def classified_deck_card_overrides(classification: str = "classified") -> dict:
    """
    Field overrides for a classified deck-card stub.

    Keeps name / quantity / category / sort; strips art and printed stats.
    ``classification`` is ``classified`` (preview lock) or ``top_secret``.
    """
    kind = (
        "top_secret" if classification == "top_secret" else "classified"
    )
    return {
        "card_art_path": None,
        "card_art_version": None,
        "invoke_cost": 0,
        "cost": [],
        "threat_level": "0",
        "types_line": "TOP SECRET" if kind == "top_secret" else "CLASSIFIED",
        "hand_size": 0,
        "ram_capacity": 0,
        "power_capacity": 0,
        "metal_capacity": 0,
        "spirit_capacity": 0,
        "steel_capacity": 0,
        "time_capacity": 0,
        "lif_capacity": 0,
        "is_classified": True,
        "classification": kind,
    }
