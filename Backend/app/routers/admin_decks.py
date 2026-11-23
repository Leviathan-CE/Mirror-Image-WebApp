"""Staff deck search and per-deck print price."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedColumn

from app.db import get_connection
from app.security import get_current_staff_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin-decks"])

PRINT_PRICE_MIN_CENTS = 50
PRINT_PRICE_MAX_CENTS = 100_000
_VISIBILITY = {"all", "public", "private"}


class AdminDeckItem(BaseModel):
    id: int
    name: str | None
    description: str | None
    is_public: bool
    author_name: str
    owner_id: int
    card_count: int
    print_price_cents: int | None


class AdminDeckListResponse(BaseModel):
    items: list[AdminDeckItem]
    total: int
    limit: int
    offset: int


class DeckPrintPricePatch(BaseModel):
    print_price_cents: int | None = Field(
        description="Null uses the standard price. 0 is free."
    )

    @field_validator("print_price_cents")
    @classmethod
    def _in_range(cls, value: int | None) -> int | None:
        if value is None or value == 0:
            return value
        if value < PRINT_PRICE_MIN_CENTS:
            raise ValueError("print_price_too_small")
        if value > PRINT_PRICE_MAX_CENTS:
            raise ValueError("print_price_too_large")
        return value


def _like_needle(raw: str) -> str:
    escaped = raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _row_item(row: tuple) -> AdminDeckItem:
    price = None
    if row[7] is not None:
        price = int(row[7])
    return AdminDeckItem(
        id=int(row[0]),
        name=row[1],
        description=row[2],
        is_public=bool(row[3]),
        author_name=row[4],
        owner_id=int(row[5]),
        card_count=int(row[6]),
        print_price_cents=price,
    )


@router.get("/decks", response_model=AdminDeckListResponse)
def list_decks(
    q: str | None = Query(default=None, max_length=80),
    visibility: str = Query(default="all", max_length=16),
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _staff_id: int = Depends(get_current_staff_user_id),
):
    mode = visibility.strip().lower()
    if mode not in _VISIBILITY:
        raise HTTPException(status_code=400, detail="invalid_visibility")

    where = ["TRUE"]
    params: dict = {"limit": limit, "offset": offset}
    needle = (q or "").strip()
    if needle:
        where.append(
            """
            (
                d.name ILIKE %(q)s ESCAPE '\\'
                OR u.user_name ILIKE %(q)s ESCAPE '\\'
                OR CAST(d.id AS TEXT) = %(exact)s
            )
            """
        )
        params["q"] = _like_needle(needle)
        params["exact"] = needle
    if mode == "public":
        where.append("uhd.is_public = TRUE")
    if mode == "private":
        where.append("uhd.is_public = FALSE")

    where_sql = " AND ".join(where)
    from_sql = """
        FROM decks d
        JOIN user_has_decks uhd ON uhd.deck_id = d.id
        JOIN users u ON u.id = uhd.user_id
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*)::int {from_sql} WHERE {where_sql}",
                    params,
                )
                total = int(cur.fetchone()[0])
                cur.execute(
                    f"""
                    SELECT
                        d.id,
                        d.name,
                        d.description,
                        uhd.is_public,
                        u.user_name,
                        uhd.user_id,
                        COALESCE((
                            SELECT SUM(dhc.quantity)
                              FROM deck_has_cards dhc
                             WHERE dhc.deck_id = d.id
                        ), 0)::int,
                        d.print_price_cents
                    {from_sql}
                    WHERE {where_sql}
                    ORDER BY d.id DESC
                    LIMIT %(limit)s OFFSET %(offset)s
                    """,
                    params,
                )
                items = [_row_item(row) for row in cur.fetchall()]
    except UndefinedColumn as exc:
        logger.warning("deck print price column missing: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="deck_print_price_schema_missing",
        ) from exc
    except OperationalError as exc:
        logger.warning("db error on admin deck list: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="database_unavailable",
        ) from exc

    return AdminDeckListResponse(
        items=items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/decks/{deck_id}/print-price", response_model=AdminDeckItem)
def patch_print_price(
    deck_id: int,
    body: DeckPrintPricePatch,
    _staff_id: int = Depends(get_current_staff_user_id),
):
    if deck_id <= 0:
        raise HTTPException(status_code=404, detail="deck_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE decks
                       SET print_price_cents = %(price)s
                     WHERE id = %(deck_id)s
                    """,
                    {"price": body.print_price_cents, "deck_id": deck_id},
                )
                if cur.rowcount == 0:
                    raise HTTPException(
                        status_code=404,
                        detail="deck_not_found",
                    )
                cur.execute(
                    """
                    SELECT
                        d.id,
                        d.name,
                        d.description,
                        uhd.is_public,
                        u.user_name,
                        uhd.user_id,
                        COALESCE((
                            SELECT SUM(dhc.quantity)
                              FROM deck_has_cards dhc
                             WHERE dhc.deck_id = d.id
                        ), 0)::int,
                        d.print_price_cents
                      FROM decks d
                      JOIN user_has_decks uhd ON uhd.deck_id = d.id
                      JOIN users u ON u.id = uhd.user_id
                     WHERE d.id = %(deck_id)s
                    """,
                    {"deck_id": deck_id},
                )
                row = cur.fetchone()
            conn.commit()
    except HTTPException:
        raise
    except UndefinedColumn as exc:
        logger.warning("deck print price column missing: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="deck_print_price_schema_missing",
        ) from exc
    except OperationalError as exc:
        logger.warning("db error on deck print price: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="database_unavailable",
        ) from exc

    if row is None:
        raise HTTPException(status_code=404, detail="deck_not_found")
    return _row_item(row)
