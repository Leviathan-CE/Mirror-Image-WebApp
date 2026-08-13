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
from app.deck_defaults import DEFAULT_DECK_CATEGORY_NAMES
from app.decks.schemas import DeckCardEntry, DeckCategoryOut, DeckSummary
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
        SELECT COALESCE(SUM(quantity), 0)::int
        FROM deck_has_cards
        WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    return int(cur.fetchone()[0] or 0)


def seed_default_categories(cur, deck_id: int) -> None:
    for sort_order, name in enumerate(DEFAULT_DECK_CATEGORY_NAMES):
        cur.execute(
            """
            INSERT INTO deck_categories (deck_id, name, sort_order)
            VALUES (%(deck_id)s, %(name)s, %(sort_order)s)
            ON CONFLICT (deck_id, name) DO NOTHING
            """,
            {"deck_id": deck_id, "name": name, "sort_order": sort_order},
        )


def fetch_deck_categories(cur, deck_id: int) -> list[DeckCategoryOut]:
    cur.execute(
        """
        SELECT id, name, sort_order
        FROM deck_categories
        WHERE deck_id = %(deck_id)s
        ORDER BY sort_order ASC, id ASC
        """,
        {"deck_id": deck_id},
    )
    return [
        DeckCategoryOut(id=row[0], name=row[1], sort_order=int(row[2]))
        for row in cur.fetchall()
    ]


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
            CASE WHEN name = 'Main' THEN 0 ELSE 1 END,
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
            c.card_art_path,
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
        entry = DeckCardEntry(
            card_id=row[0],
            card_name=row[1],
            quantity=int(row[2]),
            category_id=int(row[3]),
            category_name=row[4],
            sort_order=int(row[5]),
            card_art_path=row[6],
            invoke_cost=int(row[7] or 0),
            types_line=row[8] or "",
            card_art_version=int(row[9]) if row[9] is not None else None,
            cost=list(row[10] or []),
            hand_size=int(row[11] or 0),
            ram_capacity=int(row[12] or 0),
            power_capacity=int(row[13] or 0),
            metal_capacity=int(row[14] or 0),
            spirit_capacity=int(row[15] or 0),
            steel_capacity=int(row[16] or 0),
            time_capacity=int(row[17] or 0),
            lif_capacity=int(row[18] or 0),
            is_classified=False,
            classification=None,
        )
        kind = deck_card_classification(
            row[19],
            bypass=bypass,
            include_preview=include_preview,
        )
        if kind is not None:
            entry = entry.model_copy(
                update=classified_deck_card_overrides(kind)
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
        if entry.card_id == card_id
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


def summary_from_owner_row(
    row: tuple,
    card_count_value: int,
    *,
    like_count: int = 0,
    view_count: int = 0,
    tags: list[str] | None = None,
    liked_by_me: bool = False,
) -> DeckSummary:
    return DeckSummary(
        id=row[0],
        name=row[1],
        description=row[2],
        cover_image_path=row[3],
        is_public=bool(row[5]),
        author_name=row[6],
        card_count=card_count_value,
        like_count=like_count,
        view_count=view_count,
        tags=list(tags or []),
        liked_by_me=liked_by_me,
    )


def summary_with_community(
    cur,
    row: tuple,
    card_count_value: int,
    *,
    viewer_id: int | None = None,
) -> DeckSummary:
    stats = community_fields(cur, int(row[0]), viewer_id=viewer_id)
    return summary_from_owner_row(row, card_count_value, **stats)
