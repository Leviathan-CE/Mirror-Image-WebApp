"""
Deck SQL helpers + summary builders.

Owns reads/writes that are shared across multiple routes (categories, cards,
counts, default seeding). Route handlers should call these instead of inlining
similar SELECT/INSERT blocks.
"""

from __future__ import annotations

import re

from fastapi import HTTPException

from app.card_publish import (
    classified_deck_card_overrides,
    deck_card_classification,
)
from app.deck_community import community_fields
from app.deck_defaults import (
    DEFAULT_DECK_CATEGORIES,
    category_in_deck_default,
)
from app.decks.colors import fetch_deck_identity_costs
from app.decks.schemas import CardSummary, DeckCardEntry, DeckCategoryOut, DeckSummary
from app.media_urls import signed_media_path
from app.profanity import reject_if_profane


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "deck"


def normalize_category_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="invalid_category_name")
    reject_if_profane(normalized, field="category_name")
    return normalized


def card_count(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(SUM(dhc.quantity), 0)::int
        FROM deck_has_cards dhc
        JOIN deck_categories dc ON dc.id = dhc.category_id
        WHERE dhc.deck_id = %(deck_id)s
          AND dc.in_deck = TRUE
        """,
        {"deck_id": deck_id},
    )
    return int(cur.fetchone()[0] or 0)


def category_out(row) -> DeckCategoryOut:
    return DeckCategoryOut(
        id=row[0],
        name=row[1],
        sort_order=int(row[2]),
        in_deck=bool(row[3]),
    )


def seed_default_categories(
    cur, deck_id: int, names: list[str] | None = None
) -> None:
    """Seed starting sections. `names` overrides the stock Entity/Cyberspell pair."""
    pairs: list[tuple[str, bool]]
    if names:
        pairs = [(name, category_in_deck_default(name)) for name in names]
    else:
        pairs = list(DEFAULT_DECK_CATEGORIES)
    for sort_order, (name, in_deck) in enumerate(pairs):
        cur.execute(
            """
            INSERT INTO deck_categories (deck_id, name, sort_order, in_deck)
            VALUES (%(deck_id)s, %(name)s, %(sort_order)s, %(in_deck)s)
            ON CONFLICT (deck_id, name) DO NOTHING
            """,
            {
                "deck_id": deck_id,
                "name": name,
                "sort_order": sort_order,
                "in_deck": in_deck,
            },
        )


def fetch_deck_categories(cur, deck_id: int) -> list[DeckCategoryOut]:
    cur.execute(
        """
        SELECT id, name, sort_order, in_deck
        FROM deck_categories
        WHERE deck_id = %(deck_id)s
        ORDER BY sort_order ASC, id ASC
        """,
        {"deck_id": deck_id},
    )
    return [category_out(row) for row in cur.fetchall()]


def require_category_on_deck(
    cur, deck_id: int, category_id: int
) -> tuple[int, str, int]:
    cur.execute(
        """
        SELECT id, name, sort_order
        FROM deck_categories
        WHERE deck_id = %(deck_id)s
          AND id = %(category_id)s
        """,
        {"deck_id": deck_id, "category_id": category_id},
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="category_not_found")
    return int(row[0]), row[1], int(row[2])


def default_category_id(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT id
        FROM deck_categories
        WHERE deck_id = %(deck_id)s
        ORDER BY
            CASE WHEN in_deck THEN 0 ELSE 1 END,
            CASE WHEN lower(btrim(name)) IN ('entity', 'main') THEN 0 ELSE 1 END,
            sort_order ASC,
            id ASC
        LIMIT 1
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="category_not_found")
    return int(row[0])


def fetch_deck_cards(
    cur,
    deck_id: int,
    category_id: int | None = None,
    *,
    bypass: bool = False,
    include_preview: bool = False,
) -> list[DeckCardEntry]:
    sql = """
        SELECT
            dhc.card_id,
            c.card_name,
            dhc.quantity,
            dhc.category_id,
            dc.name,
            dhc.sort_order,
            c.illustration_thumbnail_path,
            c.card_thumbnail_path,
            c.invoke_cost,
            c.types_line,
            EXTRACT(EPOCH FROM c.updated_at)::bigint,
            c.cost,
            c.hand_size,
            c.ram_capacity,
            c.power_capacity,
            c.metal_capacity,
            c.spirit_capacity,
            c.steel_capacity,
            c.time_capacity,
            c.lif_capacity,
            c.threat_level,
            c.super_types,
            c.sub_types,
            c.is_pilot,
            c.is_augment,
            c.is_summon,
            pc.published
        FROM deck_has_cards dhc
        JOIN cards c ON c.id = dhc.card_id
        JOIN deck_categories dc ON dc.id = dhc.category_id
        LEFT JOIN publish_cards pc ON pc.card_id = c.id
        WHERE dhc.deck_id = %(deck_id)s
    """
    params: dict = {"deck_id": deck_id}
    if category_id is not None:
        sql += " AND dhc.category_id = %(category_id)s"
        params["category_id"] = category_id
    sql += " ORDER BY dc.sort_order ASC, dhc.sort_order ASC, c.card_name ASC"

    cur.execute(sql, params)
    entries: list[DeckCardEntry] = []
    for row in cur.fetchall():
        card = CardSummary(
            id=int(row[0]),
            card_name=row[1],
            card_art_path=signed_media_path(row[6]),
            card_thumbnail_path=signed_media_path(row[7]),
            invoke_cost=int(row[8] or 0),
            types_line=row[9] or "",
            card_art_version=int(row[10]) if row[10] is not None else None,
            cost=list(row[11] or []),
            hand_size=int(row[12] or 0),
            ram_capacity=int(row[13] or 0),
            power_capacity=int(row[14] or 0),
            metal_capacity=int(row[15] or 0),
            spirit_capacity=int(row[16] or 0),
            steel_capacity=int(row[17] or 0),
            time_capacity=int(row[18] or 0),
            lif_capacity=int(row[19] or 0),
            threat_level=str(row[20] if row[20] is not None else "0"),
            super_types=list(row[21] or []),
            sub_types=list(row[22] or []),
            is_pilot=bool(row[23]),
            is_augment=bool(row[24]),
            is_summon=bool(row[25]),
        )
        entry = DeckCardEntry(
            quantity=int(row[2]),
            category_id=int(row[3]),
            category_name=row[4],
            sort_order=int(row[5]),
            card=card,
            is_classified=False,
            classification=None,
        )
        kind = deck_card_classification(
            row[26],
            bypass=bypass,
            include_preview=include_preview,
        )
        if kind is not None:
            overrides = classified_deck_card_overrides(kind)
            card_overrides = overrides.pop("card")
            entry = entry.model_copy(
                update={
                    **overrides,
                    "card": entry.card.model_copy(update=card_overrides),
                }
            )
        entries.append(entry)
    return entries


def fetch_one_deck_card(
    cur,
    deck_id: int,
    card_id: int,
    category_id: int,
    *,
    bypass: bool = False,
    include_preview: bool = False,
) -> DeckCardEntry:
    cards = [
        entry
        for entry in fetch_deck_cards(
            cur,
            deck_id,
            category_id,
            bypass=bypass,
            include_preview=include_preview,
        )
        if entry.card.id == card_id
    ]
    if not cards:
        raise HTTPException(status_code=404, detail="deck_card_not_found")
    return cards[0]


def next_card_sort_order(cur, deck_id: int, category_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(MAX(sort_order), -1) + 1
        FROM deck_has_cards
        WHERE deck_id = %(deck_id)s
          AND category_id = %(category_id)s
        """,
        {"deck_id": deck_id, "category_id": category_id},
    )
    return int(cur.fetchone()[0])


def next_category_sort_order(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(MAX(sort_order), -1) + 1
        FROM deck_categories
        WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    return int(cur.fetchone()[0])


# Correlated subselects for list endpoints (alias the decks table as `d`).
PILOT_ART_SELECT = """
            (
                SELECT c.illustration_thumbnail_path
                  FROM deck_has_cards dhc
                  JOIN deck_categories dc ON dc.id = dhc.category_id
                  JOIN cards c ON c.id = dhc.card_id
                 WHERE dhc.deck_id = d.id
                   AND lower(btrim(dc.name)) = 'pilot'
                 ORDER BY dhc.sort_order ASC NULLS LAST, dhc.card_id ASC
                 LIMIT 1
            ) AS card_art_path,
            (
                SELECT EXTRACT(EPOCH FROM c.updated_at)::bigint
                  FROM deck_has_cards dhc
                  JOIN deck_categories dc ON dc.id = dhc.category_id
                  JOIN cards c ON c.id = dhc.card_id
                 WHERE dhc.deck_id = d.id
                   AND lower(btrim(dc.name)) = 'pilot'
                 ORDER BY dhc.sort_order ASC NULLS LAST, dhc.card_id ASC
                 LIMIT 1
            ) AS card_art_version
"""


def fetch_pilot_card_art(cur, deck_id: int) -> tuple[str | None, int | None]:
    """Pilot illustration for list cards (illustration_thumbnail_path)."""
    cur.execute(
        """
        SELECT c.illustration_thumbnail_path, EXTRACT(EPOCH FROM c.updated_at)::bigint
          FROM deck_has_cards dhc
          JOIN deck_categories dc ON dc.id = dhc.category_id
          JOIN cards c ON c.id = dhc.card_id
         WHERE dhc.deck_id = %(deck_id)s
           AND lower(btrim(dc.name)) = 'pilot'
         ORDER BY dhc.sort_order ASC NULLS LAST, dhc.card_id ASC
         LIMIT 1
        """,
        {"deck_id": deck_id},
    )
    art = cur.fetchone()
    if not art:
        return None, None
    version = int(art[1]) if art[1] is not None else None
    return signed_media_path(art[0]), version


def summary_from_owner_row(
    row: tuple,
    card_count_value: int,
    *,
    like_count: int = 0,
    view_count: int = 0,
    tags: list[str] | None = None,
    liked_by_me: bool = False,
    card_art_path: str | None = None,
    card_art_version: int | None = None,
    identity_cost: list[str] | None = None,
) -> DeckSummary:
    return DeckSummary(
        id=row[0],
        name=row[1],
        description=row[2],
        cover_image_path=signed_media_path(row[3]),
        is_public=bool(row[5]),
        author_name=row[6],
        card_count=card_count_value,
        like_count=like_count,
        view_count=view_count,
        tags=list(tags or []),
        liked_by_me=liked_by_me,
        card_art_path=card_art_path,
        card_art_version=card_art_version,
        identity_cost=list(identity_cost or []),
    )


def summary_with_community(
    cur,
    row: tuple,
    card_count_value: int,
    *,
    viewer_id: int | None = None,
) -> DeckSummary:
    stats = community_fields(cur, int(row[0]), viewer_id=viewer_id)
    deck_id = int(row[0])
    art_path, art_version = fetch_pilot_card_art(cur, deck_id)
    identity_cost = fetch_deck_identity_costs(cur, [deck_id]).get(deck_id, [])
    return summary_from_owner_row(
        row,
        card_count_value,
        card_art_path=art_path,
        card_art_version=art_version,
        identity_cost=identity_cost,
        **stats,
    )
