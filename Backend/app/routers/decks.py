"""Deck list routes for authenticated operators."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2 import OperationalError
from pydantic import BaseModel

from app.db import get_connection
from app.security import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/decks", tags=["decks"])


class DeckSummary(BaseModel):
    id: int
    name: str | None
    description: str | None
    is_public: bool
    card_count: int


@router.get("/me", response_model=list[DeckSummary])
def list_my_decks(user_id: int = Depends(get_current_user_id)):
    """Return decks owned by the current user."""
    sql = """
        SELECT
            d.id,
            d.name,
            d.description,
            uhd.is_public,
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
        WHERE uhd.user_id = %(user_id)s
        ORDER BY d.id DESC
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql, {"user_id": user_id})
                rows = cur.fetchall()
    except OperationalError as e:
        logger.warning("db error on /decks/me: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database_unavailable",
        ) from e

    return [
        DeckSummary(
            id=row[0],
            name=row[1],
            description=row[2],
            is_public=bool(row[3]),
            card_count=int(row[4] or 0),
        )
        for row in rows
    ]
