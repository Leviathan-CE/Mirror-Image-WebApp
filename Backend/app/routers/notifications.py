"""Logged-in inbox: list, unread count, mark read."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedTable

from app.db import get_connection
from app.features import load_granted_feature_keys
from app.notifications import (
    allowed_kinds_from_prefs,
    can_see_preview_audience,
)
from app.security import get_current_user_id
from app.user_preferences import normalize_user_preferences

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationItem(BaseModel):
    id: int
    kind: str
    subject_type: str
    subject_id: int
    title: str
    summary: str
    payload: dict[str, Any]
    audience: str
    created_at: str | None = None
    read: bool = False


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    total: int
    unread: int
    limit: int
    offset: int


class UnreadCountResponse(BaseModel):
    unread: int


class MarkReadResult(BaseModel):
    read: int


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _visible_where() -> str:
    return """
        e.created_at >= %(since)s
        AND e.kind = ANY(%(kinds)s)
        AND (
            e.audience = 'all'
            OR (%(include_preview)s AND e.audience = 'preview')
        )
    """


def _load_inbox_context(cur, user_id: int) -> dict[str, Any] | None:
    cur.execute(
        """
        SELECT role, subscription_status, created_at,
               COALESCE(preferences, '{}'::jsonb)
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    row = cur.fetchone()
    if row is None:
        return None
    role = row[0] or "user"
    sub_status = row[1] or "none"
    granted = load_granted_feature_keys(cur, user_id)
    prefs = normalize_user_preferences(row[3] if isinstance(row[3], dict) else {})
    return {
        "since": row[2],
        "kinds": allowed_kinds_from_prefs(prefs),
        "include_preview": can_see_preview_audience(
            role=role,
            subscription_status=sub_status,
            granted_keys=granted,
        ),
        "user_id": user_id,
    }


def _empty_list(limit: int, offset: int) -> NotificationListResponse:
    return NotificationListResponse(
        items=[],
        total=0,
        unread=0,
        limit=limit,
        offset=offset,
    )


def _db_error(exc: Exception) -> HTTPException:
    if isinstance(exc, UndefinedTable):
        return HTTPException(
            status_code=503,
            detail="notifications_schema_missing",
        )
    return HTTPException(status_code=503, detail="database_unavailable")


def _count_visible(cur, ctx: dict[str, Any], *, unread_only: bool) -> int:
    extra = ""
    if unread_only:
        extra = """
            AND NOT EXISTS (
                SELECT 1
                  FROM user_notification_reads r
                 WHERE r.event_id = e.id
                   AND r.user_id = %(user_id)s
            )
        """
    cur.execute(
        f"""
        SELECT COUNT(*)::int
          FROM notification_events e
         WHERE {_visible_where()}
         {extra}
        """,
        ctx,
    )
    row = cur.fetchone()
    return int(row[0] if row else 0)


@router.get("", response_model=NotificationListResponse)
def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                ctx = _load_inbox_context(cur, user_id)
                if ctx is None:
                    raise HTTPException(
                        status_code=401,
                        detail="invalid_token_subject",
                    )
                if not ctx["kinds"]:
                    return _empty_list(limit, offset)
                total = _count_visible(cur, ctx, unread_only=False)
                unread = _count_visible(cur, ctx, unread_only=True)
                params = {
                    **ctx,
                    "limit": limit,
                    "offset": offset,
                }
                cur.execute(
                    f"""
                    SELECT
                        e.id,
                        e.kind,
                        e.subject_type,
                        e.subject_id,
                        e.title,
                        e.summary,
                        e.payload,
                        e.audience,
                        e.created_at,
                        EXISTS (
                            SELECT 1
                              FROM user_notification_reads r
                             WHERE r.event_id = e.id
                               AND r.user_id = %(user_id)s
                        )
                      FROM notification_events e
                     WHERE {_visible_where()}
                     ORDER BY e.id DESC
                     LIMIT %(limit)s OFFSET %(offset)s
                    """,
                    params,
                )
                rows = cur.fetchall()
    except HTTPException:
        raise
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e
    except Exception as e:
        logger.exception("unexpected error on notification list: %s", e)
        raise HTTPException(
            status_code=500,
            detail="notification_list_failed",
        ) from e

    items = [
        NotificationItem(
            id=int(row[0]),
            kind=row[1],
            subject_type=row[2],
            subject_id=int(row[3]),
            title=row[4],
            summary=row[5] or "",
            payload=row[6] if isinstance(row[6], dict) else {},
            audience=row[7],
            created_at=_iso(row[8]),
            read=bool(row[9]),
        )
        for row in rows
    ]
    return NotificationListResponse(
        items=items,
        total=total,
        unread=unread,
        limit=limit,
        offset=offset,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
def unread_count(user_id: int = Depends(get_current_user_id)):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                ctx = _load_inbox_context(cur, user_id)
                if ctx is None:
                    raise HTTPException(
                        status_code=401,
                        detail="invalid_token_subject",
                    )
                if not ctx["kinds"]:
                    return UnreadCountResponse(unread=0)
                unread = _count_visible(cur, ctx, unread_only=True)
    except HTTPException:
        raise
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e
    except Exception as e:
        logger.exception("unexpected error on unread count: %s", e)
        raise HTTPException(
            status_code=500,
            detail="notification_unread_failed",
        ) from e
    return UnreadCountResponse(unread=unread)


@router.post("/read-all", response_model=MarkReadResult)
def mark_all_notifications_read(
    user_id: int = Depends(get_current_user_id),
):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                ctx = _load_inbox_context(cur, user_id)
                if ctx is None:
                    raise HTTPException(
                        status_code=401,
                        detail="invalid_token_subject",
                    )
                if not ctx["kinds"]:
                    return MarkReadResult(read=0)
                cur.execute(
                    f"""
                    INSERT INTO user_notification_reads (user_id, event_id)
                    SELECT %(user_id)s, e.id
                      FROM notification_events e
                     WHERE {_visible_where()}
                       AND NOT EXISTS (
                            SELECT 1
                              FROM user_notification_reads r
                             WHERE r.event_id = e.id
                               AND r.user_id = %(user_id)s
                       )
                    """,
                    ctx,
                )
                marked = int(cur.rowcount or 0)
            conn.commit()
    except HTTPException:
        raise
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e
    except Exception as e:
        logger.exception("unexpected error on mark all read: %s", e)
        raise HTTPException(
            status_code=500,
            detail="notification_read_all_failed",
        ) from e
    return MarkReadResult(read=marked)


@router.post("/{event_id}/read", response_model=MarkReadResult)
def mark_notification_read(
    event_id: int,
    user_id: int = Depends(get_current_user_id),
):
    if event_id <= 0:
        raise HTTPException(status_code=404, detail="notification_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                ctx = _load_inbox_context(cur, user_id)
                if ctx is None:
                    raise HTTPException(
                        status_code=401,
                        detail="invalid_token_subject",
                    )
                if not ctx["kinds"]:
                    raise HTTPException(
                        status_code=404,
                        detail="notification_not_found",
                    )
                cur.execute(
                    f"""
                    SELECT e.id
                      FROM notification_events e
                     WHERE e.id = %(event_id)s
                       AND {_visible_where()}
                    """,
                    {**ctx, "event_id": event_id},
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="notification_not_found",
                    )
                cur.execute(
                    """
                    INSERT INTO user_notification_reads (user_id, event_id)
                    VALUES (%(user_id)s, %(event_id)s)
                    ON CONFLICT (user_id, event_id) DO NOTHING
                    """,
                    {"user_id": user_id, "event_id": event_id},
                )
                marked = int(cur.rowcount or 0)
            conn.commit()
    except HTTPException:
        raise
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e
    except Exception as e:
        logger.exception("unexpected error on mark read: %s", e)
        raise HTTPException(
            status_code=500,
            detail="notification_read_failed",
        ) from e
    return MarkReadResult(read=marked)
