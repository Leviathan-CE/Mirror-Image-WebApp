"""Admin-only catalogue card routes (publish status + lagality bulk tools)."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from psycopg2 import OperationalError

from app.card_library_query import apply_catalogue_filters, catalogue_order_sql
from app.db import get_connection
from app.security import get_current_admin_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cards/admin", tags=["admin-cards"])

PUBLISH_STATUSES = ("published", "preview", "not published")


class AdminCardItem(BaseModel):
    """Catalogue row for the admin cards DB console."""

    id: int
    card_name: str
    card_set_name: str
    rarity: str
    lagality: str
    published: str
    is_deprecated: bool = False
    card_art_path: str | None = None
    card_art_version: int | None = None


class AdminCardLibraryResponse(BaseModel):
    items: list[AdminCardItem]
    total: int
    limit: int
    offset: int


class AdminCardBulkUpdate(BaseModel):
    """Apply publish status and/or lagality to many cards at once."""

    card_ids: list[int] = Field(min_length=1, max_length=500)
    published: str | None = None
    lagality: str | None = None

    @field_validator("published")
    @classmethod
    def _check_published(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value not in PUBLISH_STATUSES:
            raise ValueError("invalid_published_status")
        return value

    @field_validator("lagality")
    @classmethod
    def _check_lagality(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned or len(cleaned) > 60:
            raise ValueError("invalid_lagality")
        return cleaned

    @field_validator("card_ids")
    @classmethod
    def _unique_positive_ids(cls, value: list[int]) -> list[int]:
        seen: set[int] = set()
        out: list[int] = []
        for card_id in value:
            if card_id <= 0:
                raise ValueError("invalid_card_id")
            if card_id not in seen:
                seen.add(card_id)
                out.append(card_id)
        return out


class AdminCardBulkResult(BaseModel):
    updated: int


@router.get("/library", response_model=AdminCardLibraryResponse)
def admin_browse_cards(
    q: str | None = Query(default=None, max_length=80),
    description: str | None = Query(default=None, max_length=200),
    invoke_cost_min: int | None = Query(default=None, ge=0, le=99),
    invoke_cost_max: int | None = Query(default=None, ge=0, le=99),
    color: list[str] | None = Query(default=None),
    types_line: str | None = Query(default=None, max_length=80),
    super_type: str | None = Query(default=None, max_length=60),
    sub_type: str | None = Query(default=None, max_length=60),
    limit: int = Query(default=48, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _admin_id: int = Depends(get_current_admin_user_id),
):
    """
    Admin catalogue browse.

    Same filter surface as `/cards/library` (name, description, colours,
    invoke cost, type line, super/sub types). Includes deprecated cards and
    publish/lagality fields; no publish visibility gate.
    """
    where = ["TRUE"]
    params: dict[str, Any] = {"limit": limit, "offset": offset}

    has_name_query = apply_catalogue_filters(
        where,
        params,
        alias="c",
        q=q,
        description=description,
        invoke_cost_min=invoke_cost_min,
        invoke_cost_max=invoke_cost_max,
        color=color,
        types_line=types_line,
        super_type=super_type,
        sub_type=sub_type,
    )

    where_sql = " AND ".join(where)
    order_sql = catalogue_order_sql(has_name_query, alias="c")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT COUNT(*)::int FROM cards c WHERE {where_sql}",
                    params,
                )
                total = int(cur.fetchone()[0])

                cur.execute(
                    f"""
                    SELECT
                        c.id,
                        c.card_name,
                        c.card_set_name,
                        c.rarity,
                        c.lagality,
                        COALESCE(p.published, 'not published'),
                        c.is_deprecated,
                        c.card_art_path,
                        EXTRACT(EPOCH FROM c.updated_at)::bigint
                      FROM cards c
                      LEFT JOIN publish_cards p ON p.card_id = c.id
                     WHERE {where_sql}
                     ORDER BY {order_sql}
                     LIMIT %(limit)s OFFSET %(offset)s
                    """,
                    params,
                )
                rows = cur.fetchall()
    except OperationalError as e:
        logger.warning("db error on admin card library: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on admin card library: %s", e)
        raise HTTPException(status_code=500, detail="admin_card_library_failed") from e

    items = [
        AdminCardItem(
            id=int(row[0]),
            card_name=row[1],
            card_set_name=row[2],
            rarity=row[3],
            lagality=row[4] or "Legal",
            published=row[5] or "not published",
            is_deprecated=bool(row[6]),
            card_art_path=row[7],
            card_art_version=int(row[8]) if row[8] is not None else None,
        )
        for row in rows
    ]
    return AdminCardLibraryResponse(
        items=items, total=total, limit=limit, offset=offset
    )


@router.patch("/bulk", response_model=AdminCardBulkResult)
def admin_bulk_update_cards(
    body: AdminCardBulkUpdate,
    _admin_id: int = Depends(get_current_admin_user_id),
):
    """Set publish status and/or lagality on selected catalogue cards."""
    if body.published is None and body.lagality is None:
        raise HTTPException(status_code=400, detail="nothing_to_update")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                updated = 0
                if body.lagality is not None:
                    cur.execute(
                        """
                        UPDATE cards
                           SET lagality = %(lagality)s,
                               updated_at = NOW()
                         WHERE id = ANY(%(ids)s)
                        """,
                        {"lagality": body.lagality, "ids": body.card_ids},
                    )
                    updated = max(updated, cur.rowcount)

                if body.published is not None:
                    cur.execute(
                        """
                        INSERT INTO publish_cards (card_id, published)
                        SELECT id, %(published)s
                          FROM cards
                         WHERE id = ANY(%(ids)s)
                        ON CONFLICT (card_id) DO UPDATE
                           SET published = EXCLUDED.published
                        """,
                        {"published": body.published, "ids": body.card_ids},
                    )
                    updated = max(updated, cur.rowcount)
            conn.commit()
    except OperationalError as e:
        logger.warning("db error on admin bulk update: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    except Exception as e:
        logger.exception("unexpected error on admin bulk update: %s", e)
        raise HTTPException(status_code=500, detail="admin_bulk_update_failed") from e

    return AdminCardBulkResult(updated=updated)
