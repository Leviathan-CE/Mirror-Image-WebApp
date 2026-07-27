"""
Deck builder API.

Read (public decks — anyone; private — owner only):
  GET    /decks/default-categories
  GET    /decks/public
  GET    /decks/{deck_id}
  GET    /decks/{deck_id}/categories
  GET    /decks/{deck_id}/cards

Write (owner only, Bearer JWT required):
  GET    /decks/me
  POST   /decks
  PATCH  /decks/{deck_id}
  DELETE /decks/{deck_id}
  POST   /decks/{deck_id}/cover
  POST   /decks/{deck_id}/categories
  PATCH  /decks/{deck_id}/categories/{category_id}
  DELETE /decks/{deck_id}/categories/{category_id}
  POST   /decks/{deck_id}/cards
  PATCH  /decks/{deck_id}/cards/{card_id}
  DELETE /decks/{deck_id}/cards/{card_id}
  PUT    /decks/{deck_id}/cards/order
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import ForeignKeyViolation, UniqueViolation

from app.db import get_connection
from app.deck_defaults import DEFAULT_DECK_CATEGORY_NAMES
from app.card_publish import catalogue_visibility_sql, get_optional_include_preview
from app.security import (
    get_current_user_id,
    get_optional_is_admin,
    get_optional_user_id,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/decks", tags=["decks"])

_COVER_EXT = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}
_COVER_MAX_BYTES = 2 * 1024 * 1024


# --- schemas -----------------------------------------------------------------

class DeckSummary(BaseModel):
    id: int
    name: str | None
    description: str | None
    is_public: bool
    author_name: str
    cover_image_path: str | None
    card_count: int


class DeckCreateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool = True


class DeckUpdateRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    is_public: bool | None = None


class DeckCoverUploaded(BaseModel):
    deck_id: int
    cover_image_path: str
    cover_size_bytes: int


class DeckCategoryOut(BaseModel):
    id: int
    name: str
    sort_order: int


class DeckCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    sort_order: int | None = Field(default=None, ge=0)


class DeckCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    sort_order: int | None = Field(default=None, ge=0)


class DeckCardEntry(BaseModel):
    card_id: int
    card_name: str
    quantity: int
    category_id: int
    category_name: str
    sort_order: int
    card_art_path: str | None = None
    invoke_cost: int = 0
    # Invoke-cost icon list (LIF, MET, GEN2, …) — used by playtester Accumulate.
    cost: list[Any] = Field(default_factory=list)
    types_line: str = ""
    # Epoch seconds from cards.updated_at — used to bust browser image cache.
    card_art_version: int | None = None
    # Pilot starting values (also present on other cards; usually 0).
    hand_size: int = 0
    ram_capacity: int = 0
    power_capacity: int = 0
    metal_capacity: int = 0
    spirit_capacity: int = 0
    steel_capacity: int = 0
    # Starting life total on pilots (not a resource token).
    lif_capacity: int = 0


class DeckDetail(DeckSummary):
    categories: list[DeckCategoryOut]
    cards: list[DeckCardEntry]


class AddCardRequest(BaseModel):
    card_id: int = Field(gt=0)
    quantity: int = Field(default=1, ge=1, le=99)
    category_id: int | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)


class UpdateCardRequest(BaseModel):
    quantity: int | None = Field(default=None, ge=1, le=99)
    category_id: int | None = Field(default=None, gt=0)
    sort_order: int | None = Field(default=None, ge=0)


class CardOrderItem(BaseModel):
    card_id: int = Field(gt=0)
    category_id: int = Field(gt=0)
    sort_order: int = Field(ge=0)


class ReorderCardsRequest(BaseModel):
    items: list[CardOrderItem] = Field(min_length=1)

    @field_validator("items")
    @classmethod
    def _unique_keys(cls, items: list[CardOrderItem]) -> list[CardOrderItem]:
        seen: set[tuple[int, int]] = set()
        for item in items:
            key = (item.card_id, item.category_id)
            if key in seen:
                raise ValueError("duplicate card_id+category_id in order list")
            seen.add(key)
        return items


class DefaultCategoriesResponse(BaseModel):
    categories: list[str]


# --- helpers -----------------------------------------------------------------

def _db_unavailable(exc: OperationalError) -> HTTPException:
    logger.warning("db error on decks route: %s", exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="database_unavailable",
    )


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "deck"


def _normalize_category_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="invalid_category_name")
    return normalized


def _require_owned_deck(cur, *, user_id: int, deck_id: int) -> tuple:
    """Return ownership row or raise 404. Row: deck fields + is_public + author."""
    cur.execute(
        """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            d.cover_image_mime_type,
            uhd.is_public,
            u.user_name
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.user_id = %(user_id)s
          AND uhd.deck_id = %(deck_id)s
        """,
        {"user_id": user_id, "deck_id": deck_id},
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deck_not_found")
    return row


def _require_readable_deck(cur, *, deck_id: int, user_id: int | None) -> tuple:
    """
    Return a deck row if the viewer may read it.

    Readable when:
    - `is_public` is true (anyone, including anonymous), or
    - `user_id` owns the deck (private decks).
    """
    cur.execute(
        """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            d.cover_image_mime_type,
            uhd.is_public,
            u.user_name,
            uhd.user_id
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.deck_id = %(deck_id)s
        LIMIT 1
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deck_not_found")

    is_public = bool(row[5])
    owner_id = int(row[7])
    if is_public or (user_id is not None and user_id == owner_id):
        return row[:7]

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deck_not_found")


def _card_count(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(SUM(quantity), 0)::int
        FROM deck_has_cards
        WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    return int(cur.fetchone()[0] or 0)


def _seed_default_categories(cur, deck_id: int) -> None:
    for sort_order, name in enumerate(DEFAULT_DECK_CATEGORY_NAMES):
        cur.execute(
            """
            INSERT INTO deck_categories (deck_id, name, sort_order)
            VALUES (%(deck_id)s, %(name)s, %(sort_order)s)
            ON CONFLICT (deck_id, name) DO NOTHING
            """,
            {"deck_id": deck_id, "name": name, "sort_order": sort_order},
        )


def _fetch_deck_categories(cur, deck_id: int) -> list[DeckCategoryOut]:
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


def _require_category_on_deck(cur, deck_id: int, category_id: int) -> tuple[int, str, int]:
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


def _default_category_id(cur, deck_id: int) -> int:
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


def _fetch_deck_cards(
    cur,
    deck_id: int,
    category_id: int | None = None,
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
            c.lif_capacity
        FROM deck_has_cards dhc
        JOIN cards c ON c.id = dhc.card_id
        JOIN deck_categories dc ON dc.id = dhc.category_id
        WHERE dhc.deck_id = %(deck_id)s
    """
    params: dict = {"deck_id": deck_id}
    if category_id is not None:
        sql += " AND dhc.category_id = %(category_id)s"
        params["category_id"] = category_id
    sql += " ORDER BY dc.sort_order ASC, dhc.sort_order ASC, c.card_name ASC"

    cur.execute(sql, params)
    return [
        DeckCardEntry(
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
            lif_capacity=int(row[17] or 0),
        )
        for row in cur.fetchall()
    ]


def _fetch_one_deck_card(
    cur,
    deck_id: int,
    card_id: int,
    category_id: int,
) -> DeckCardEntry:
    cards = [
        entry
        for entry in _fetch_deck_cards(cur, deck_id, category_id)
        if entry.card_id == card_id
    ]
    if not cards:
        raise HTTPException(status_code=404, detail="deck_card_not_found")
    return cards[0]


def _next_card_sort_order(cur, deck_id: int, category_id: int) -> int:
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


def _next_category_sort_order(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(MAX(sort_order), -1) + 1
        FROM deck_categories
        WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    return int(cur.fetchone()[0])


def _summary_from_owner_row(row: tuple, card_count: int) -> DeckSummary:
    return DeckSummary(
        id=row[0],
        name=row[1],
        description=row[2],
        cover_image_path=row[3],
        is_public=bool(row[5]),
        author_name=row[6],
        card_count=card_count,
    )


# --- routes ------------------------------------------------------------------

@router.get("/default-categories", response_model=DefaultCategoriesResponse)
def list_default_categories():
    """Default section names seeded on new decks (no auth required)."""
    return DefaultCategoriesResponse(categories=list(DEFAULT_DECK_CATEGORY_NAMES))


@router.get("/public", response_model=list[DeckSummary])
def list_public_decks():
    """Browse all public decks (no auth required). Read-only catalogue."""
    sql = """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            uhd.is_public,
            u.user_name,
            COALESCE(
                (
                    SELECT SUM(dhc.quantity)::int
                    FROM deck_has_cards dhc
                    WHERE dhc.deck_id = d.id
                ),
                0
            ) AS card_count
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.is_public = TRUE
        ORDER BY d.id DESC
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return [
        DeckSummary(
            id=row[0],
            name=row[1],
            description=row[2],
            cover_image_path=row[3],
            is_public=bool(row[4]),
            author_name=row[5],
            card_count=int(row[6] or 0),
        )
        for row in rows
    ]


@router.get("/me", response_model=list[DeckSummary])
def list_my_decks(user_id: int = Depends(get_current_user_id)):
    """Return decks owned by the current user."""
    sql = """
        SELECT
            d.id,
            d.name,
            d.description,
            d.cover_image_path,
            uhd.is_public,
            u.user_name,
            COALESCE(
                (
                    SELECT SUM(dhc.quantity)::int
                    FROM deck_has_cards dhc
                    WHERE dhc.deck_id = d.id
                ),
                0
            ) AS card_count
        FROM user_has_decks uhd
        JOIN decks d ON d.id = uhd.deck_id
        JOIN users u ON u.id = uhd.user_id
        WHERE uhd.user_id = %(user_id)s
        ORDER BY d.id DESC
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, {"user_id": user_id})
                rows = cur.fetchall()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return [
        DeckSummary(
            id=row[0],
            name=row[1],
            description=row[2],
            cover_image_path=row[3],
            is_public=bool(row[4]),
            author_name=row[5],
            card_count=int(row[6] or 0),
        )
        for row in rows
    ]


@router.post("", response_model=DeckSummary, status_code=status.HTTP_201_CREATED)
def create_deck(
    body: DeckCreateRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Create a deck owned by the current user (optional cover via /cover later)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO decks (name, description)
                    VALUES (%(name)s, %(description)s)
                    RETURNING id, name, description, cover_image_path, cover_image_mime_type
                    """,
                    {"name": body.name, "description": body.description},
                )
                deck = cur.fetchone()
                deck_id = deck[0]
                cur.execute(
                    """
                    INSERT INTO user_has_decks (user_id, deck_id, is_public)
                    VALUES (%(user_id)s, %(deck_id)s, %(is_public)s)
                    """,
                    {
                        "user_id": user_id,
                        "deck_id": deck_id,
                        "is_public": body.is_public,
                    },
                )
                _seed_default_categories(cur, deck_id)
                cur.execute(
                    "SELECT user_name FROM users WHERE id = %(user_id)s",
                    {"user_id": user_id},
                )
                author = cur.fetchone()[0]
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return DeckSummary(
        id=deck_id,
        name=deck[1],
        description=deck[2],
        cover_image_path=deck[3],
        is_public=body.is_public,
        author_name=author,
        card_count=0,
    )


@router.get("/{deck_id}", response_model=DeckDetail)
def get_deck(
    deck_id: int,
    user_id: int | None = Depends(get_optional_user_id),
):
    """
    Deck metadata, categories, and cards.

    Public decks: anyone. Private decks: owner only.
    Mutations still require ownership on write routes.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                categories = _fetch_deck_categories(cur, deck_id)
                cards = _fetch_deck_cards(cur, deck_id)
                count = _card_count(cur, deck_id)
    except OperationalError as e:
        raise _db_unavailable(e) from e

    summary = _summary_from_owner_row(row, count)
    return DeckDetail(**summary.model_dump(), categories=categories, cards=cards)


@router.patch("/{deck_id}", response_model=DeckSummary)
def update_deck(
    deck_id: int,
    body: DeckUpdateRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Update name, description, and/or public flag."""
    if body.name is None and body.description is None and body.is_public is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)

                if body.name is not None or body.description is not None:
                    cur.execute(
                        """
                        UPDATE decks
                           SET name = COALESCE(%(name)s, name),
                               description = COALESCE(%(description)s, description)
                         WHERE id = %(deck_id)s
                        """,
                        {
                            "name": body.name,
                            "description": body.description,
                            "deck_id": deck_id,
                        },
                    )

                if body.is_public is not None:
                    cur.execute(
                        """
                        UPDATE user_has_decks
                           SET is_public = %(is_public)s
                         WHERE user_id = %(user_id)s
                           AND deck_id = %(deck_id)s
                        """,
                        {
                            "is_public": body.is_public,
                            "user_id": user_id,
                            "deck_id": deck_id,
                        },
                    )

                row = _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                count = _card_count(cur, deck_id)
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return _summary_from_owner_row(row, count)


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deck(deck_id: int, user_id: int = Depends(get_current_user_id)):
    """Delete a deck the user owns (cascades card entries and categories)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                cur.execute("DELETE FROM decks WHERE id = %(deck_id)s", {"deck_id": deck_id})
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.post("/{deck_id}/cover", response_model=DeckCoverUploaded)
async def upload_deck_cover(
    deck_id: int,
    file: UploadFile = File(...),
    user_id: int = Depends(get_current_user_id),
):
    """Attach a cover image to a deck (png/jpeg/webp, max 2MB)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="cover_must_be_image")

    extension = _COVER_EXT.get(file.content_type)
    if extension is None:
        raise HTTPException(status_code=400, detail="unsupported_cover_type")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty_cover_file")
    if len(data) > _COVER_MAX_BYTES:
        raise HTTPException(status_code=413, detail="cover_too_large")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                deck_name = row[1] or f"deck-{deck_id}"

                base_dir = Path(__file__).resolve().parent.parent / "thumbnails" / "decks"
                deck_dir = base_dir / str(deck_id)
                deck_dir.mkdir(parents=True, exist_ok=True)

                file_name = f"{_slugify(deck_name)}_cover{extension}"
                file_path = deck_dir / file_name
                file_path.write_bytes(data)

                relative_path = f"decks/{deck_id}/{file_name}"
                cur.execute(
                    """
                    UPDATE decks
                       SET cover_image_path = %(path)s,
                           cover_image_mime_type = %(mime)s
                     WHERE id = %(deck_id)s
                    """,
                    {
                        "path": relative_path,
                        "mime": file.content_type,
                        "deck_id": deck_id,
                    },
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except OSError as e:
        logger.warning("deck cover write error: %s", e)
        raise HTTPException(status_code=500, detail="cover_write_failed") from e

    return DeckCoverUploaded(
        deck_id=deck_id,
        cover_image_path=relative_path,
        cover_size_bytes=len(data),
    )


@router.get("/{deck_id}/categories", response_model=list[DeckCategoryOut])
def list_deck_categories(
    deck_id: int,
    user_id: int | None = Depends(get_optional_user_id),
):
    """List custom categories for a readable deck."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                return _fetch_deck_categories(cur, deck_id)
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.post(
    "/{deck_id}/categories",
    response_model=DeckCategoryOut,
    status_code=status.HTTP_201_CREATED,
)
def create_deck_category(
    deck_id: int,
    body: DeckCategoryCreate,
    user_id: int = Depends(get_current_user_id),
):
    """Add a custom category to an owned deck."""
    name = _normalize_category_name(body.name)
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                sort_order = (
                    body.sort_order
                    if body.sort_order is not None
                    else _next_category_sort_order(cur, deck_id)
                )
                cur.execute(
                    """
                    INSERT INTO deck_categories (deck_id, name, sort_order)
                    VALUES (%(deck_id)s, %(name)s, %(sort_order)s)
                    RETURNING id, name, sort_order
                    """,
                    {"deck_id": deck_id, "name": name, "sort_order": sort_order},
                )
                row = cur.fetchone()
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(status_code=409, detail="category_name_taken") from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return DeckCategoryOut(id=row[0], name=row[1], sort_order=int(row[2]))


@router.patch("/{deck_id}/categories/{category_id}", response_model=DeckCategoryOut)
def update_deck_category(
    deck_id: int,
    category_id: int,
    body: DeckCategoryUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """Rename or reorder a category on an owned deck."""
    if body.name is None and body.sort_order is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    name = _normalize_category_name(body.name) if body.name is not None else None
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                _require_category_on_deck(cur, deck_id, category_id)

                cur.execute(
                    """
                    UPDATE deck_categories
                       SET name = COALESCE(%(name)s, name),
                           sort_order = COALESCE(%(sort_order)s, sort_order)
                     WHERE deck_id = %(deck_id)s
                       AND id = %(category_id)s
                    RETURNING id, name, sort_order
                    """,
                    {
                        "name": name,
                        "sort_order": body.sort_order,
                        "deck_id": deck_id,
                        "category_id": category_id,
                    },
                )
                row = cur.fetchone()
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(status_code=409, detail="category_name_taken") from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return DeckCategoryOut(id=row[0], name=row[1], sort_order=int(row[2]))


@router.delete(
    "/{deck_id}/categories/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_deck_category(
    deck_id: int,
    category_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """Remove a category from an owned deck (must be empty)."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                _require_category_on_deck(cur, deck_id, category_id)

                cur.execute(
                    """
                    SELECT 1
                    FROM deck_has_cards
                    WHERE deck_id = %(deck_id)s
                      AND category_id = %(category_id)s
                    LIMIT 1
                    """,
                    {"deck_id": deck_id, "category_id": category_id},
                )
                if cur.fetchone() is not None:
                    raise HTTPException(status_code=409, detail="category_in_use")

                cur.execute(
                    """
                    DELETE FROM deck_categories
                    WHERE deck_id = %(deck_id)s
                      AND id = %(category_id)s
                    """,
                    {"deck_id": deck_id, "category_id": category_id},
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.get("/{deck_id}/cards", response_model=list[DeckCardEntry])
def list_deck_cards(
    deck_id: int,
    category_id: int | None = Query(default=None, gt=0),
    user_id: int | None = Depends(get_optional_user_id),
):
    """List cards in a readable deck (public or owned), optionally by category."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_readable_deck(cur, deck_id=deck_id, user_id=user_id)
                if category_id is not None:
                    _require_category_on_deck(cur, deck_id, category_id)
                return _fetch_deck_cards(cur, deck_id, category_id)
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.post(
    "/{deck_id}/cards",
    response_model=DeckCardEntry,
    status_code=status.HTTP_201_CREATED,
)
def add_card_to_deck(
    deck_id: int,
    body: AddCardRequest,
    user_id: int = Depends(get_current_user_id),
    is_admin: bool = Depends(get_optional_is_admin),
    include_preview: bool = Depends(get_optional_include_preview),
):
    """
    Add a card to a deck category.

    If the same card+category already exists, quantities are summed.
    Non-subscribers may only add published cards; subscribers may also add
    preview cards; admins may add any catalogue card.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)

                cur.execute(
                    f"""
                    SELECT card_name
                      FROM cards
                     WHERE id = %(card_id)s
                       AND {catalogue_visibility_sql("cards", bypass=is_admin, include_preview=include_preview)}
                    """,
                    {"card_id": body.card_id},
                )
                card_row = cur.fetchone()
                if card_row is None:
                    raise HTTPException(status_code=404, detail="card_not_found")

                category_id = (
                    body.category_id
                    if body.category_id is not None
                    else _default_category_id(cur, deck_id)
                )
                _, category_name, _ = _require_category_on_deck(cur, deck_id, category_id)

                sort_order = (
                    body.sort_order
                    if body.sort_order is not None
                    else _next_card_sort_order(cur, deck_id, category_id)
                )

                cur.execute(
                    """
                    INSERT INTO deck_has_cards
                        (deck_id, card_id, category_id, quantity, sort_order)
                    VALUES
                        (%(deck_id)s, %(card_id)s, %(category_id)s, %(quantity)s, %(sort_order)s)
                    ON CONFLICT (deck_id, card_id, category_id)
                    DO UPDATE SET
                        quantity = deck_has_cards.quantity + EXCLUDED.quantity,
                        sort_order = COALESCE(
                            EXCLUDED.sort_order,
                            deck_has_cards.sort_order
                        )
                    RETURNING card_id, quantity, category_id, sort_order
                    """,
                    {
                        "deck_id": deck_id,
                        "card_id": body.card_id,
                        "category_id": category_id,
                        "quantity": body.quantity,
                        "sort_order": sort_order,
                    },
                )
                entry = cur.fetchone()
                result = _fetch_one_deck_card(
                    cur, deck_id, int(entry[0]), int(entry[2])
                )
            conn.commit()
    except ForeignKeyViolation as e:
        raise HTTPException(status_code=404, detail="card_not_found") from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return result


@router.patch("/{deck_id}/cards/{card_id}", response_model=DeckCardEntry)
def update_deck_card(
    deck_id: int,
    card_id: int,
    body: UpdateCardRequest,
    category_id: int = Query(
        gt=0,
        description="Current category of the entry to update",
    ),
    user_id: int = Depends(get_current_user_id),
):
    """Update quantity, move category, and/or set sort_order for one entry."""
    if body.quantity is None and body.category_id is None and body.sort_order is None:
        raise HTTPException(status_code=400, detail="no_fields_to_update")

    new_category_id = (
        body.category_id if body.category_id is not None else category_id
    )

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                _require_category_on_deck(cur, deck_id, category_id)

                cur.execute(
                    """
                    SELECT quantity, category_id, sort_order
                    FROM deck_has_cards
                    WHERE deck_id = %(deck_id)s
                      AND card_id = %(card_id)s
                      AND category_id = %(category_id)s
                    """,
                    {
                        "deck_id": deck_id,
                        "card_id": card_id,
                        "category_id": category_id,
                    },
                )
                existing = cur.fetchone()
                if existing is None:
                    raise HTTPException(status_code=404, detail="deck_card_not_found")

                quantity = body.quantity if body.quantity is not None else existing[0]
                sort_order = (
                    body.sort_order if body.sort_order is not None else existing[2]
                )

                if new_category_id != category_id:
                    _require_category_on_deck(cur, deck_id, new_category_id)
                    cur.execute(
                        """
                        DELETE FROM deck_has_cards
                        WHERE deck_id = %(deck_id)s
                          AND card_id = %(card_id)s
                          AND category_id = %(category_id)s
                        """,
                        {
                            "deck_id": deck_id,
                            "card_id": card_id,
                            "category_id": category_id,
                        },
                    )
                    cur.execute(
                        """
                        INSERT INTO deck_has_cards
                            (deck_id, card_id, category_id, quantity, sort_order)
                        VALUES
                            (%(deck_id)s, %(card_id)s, %(category_id)s, %(quantity)s, %(sort_order)s)
                        ON CONFLICT (deck_id, card_id, category_id)
                        DO UPDATE SET
                            quantity = EXCLUDED.quantity,
                            sort_order = EXCLUDED.sort_order
                        RETURNING card_id, quantity, category_id, sort_order
                        """,
                        {
                            "deck_id": deck_id,
                            "card_id": card_id,
                            "category_id": new_category_id,
                            "quantity": quantity,
                            "sort_order": sort_order,
                        },
                    )
                else:
                    cur.execute(
                        """
                        UPDATE deck_has_cards
                           SET quantity = %(quantity)s,
                               sort_order = %(sort_order)s
                         WHERE deck_id = %(deck_id)s
                           AND card_id = %(card_id)s
                           AND category_id = %(category_id)s
                        RETURNING card_id, quantity, category_id, sort_order
                        """,
                        {
                            "quantity": quantity,
                            "sort_order": sort_order,
                            "deck_id": deck_id,
                            "card_id": card_id,
                            "category_id": category_id,
                        },
                    )

                entry = cur.fetchone()
                result = _fetch_one_deck_card(
                    cur, deck_id, int(entry[0]), int(entry[2])
                )
            conn.commit()
    except UniqueViolation as e:
        raise HTTPException(
            status_code=409,
            detail="card_already_in_target_category",
        ) from e
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return result


@router.delete("/{deck_id}/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_card_from_deck(
    deck_id: int,
    card_id: int,
    category_id: int = Query(gt=0),
    user_id: int = Depends(get_current_user_id),
):
    """Remove one card entry from a deck category."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)
                _require_category_on_deck(cur, deck_id, category_id)
                cur.execute(
                    """
                    DELETE FROM deck_has_cards
                    WHERE deck_id = %(deck_id)s
                      AND card_id = %(card_id)s
                      AND category_id = %(category_id)s
                    """,
                    {
                        "deck_id": deck_id,
                        "card_id": card_id,
                        "category_id": category_id,
                    },
                )
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="deck_card_not_found")
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e


@router.put("/{deck_id}/cards/order", response_model=list[DeckCardEntry])
def reorder_deck_cards(
    deck_id: int,
    body: ReorderCardsRequest,
    user_id: int = Depends(get_current_user_id),
):
    """
    Set sort_order for many entries at once.

    Each item must already exist in the deck at the given category.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _require_owned_deck(cur, user_id=user_id, deck_id=deck_id)

                for item in body.items:
                    cur.execute(
                        """
                        UPDATE deck_has_cards
                           SET sort_order = %(sort_order)s
                         WHERE deck_id = %(deck_id)s
                           AND card_id = %(card_id)s
                           AND category_id = %(category_id)s
                        """,
                        {
                            "sort_order": item.sort_order,
                            "deck_id": deck_id,
                            "card_id": item.card_id,
                            "category_id": item.category_id,
                        },
                    )
                    if cur.rowcount == 0:
                        raise HTTPException(
                            status_code=404,
                            detail=f"deck_card_not_found:{item.card_id}:{item.category_id}",
                        )

                cards = _fetch_deck_cards(cur, deck_id)
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return cards
