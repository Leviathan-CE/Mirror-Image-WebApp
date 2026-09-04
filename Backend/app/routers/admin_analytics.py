"""Admin-only analytics overview."""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedColumn, UndefinedTable

from app.analytics import (
    fetch_activity_rows,
    fetch_overview,
    fill_activity_points,
    host_sampler,
)
from app.db import get_connection
from app.security import get_current_admin_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin-analytics"])

ActivityRange = Literal["week", "month", "year"]


class ActivityPoint(BaseModel):
    label: str
    unique_users: int
    requests: int
    logins: int


class HostMetrics(BaseModel):
    cpu_pct: float | None = None
    cpu_avg_pct: float | None = None
    memory_pct: float | None = None
    memory_avg_pct: float | None = None
    memory_used_bytes: int | None = None
    memory_total_bytes: int | None = None
    net_recv_bps: float | None = None
    net_sent_bps: float | None = None
    net_recv_avg_bps: float | None = None
    net_sent_avg_bps: float | None = None
    sample_count: int = 0


class AdminAnalyticsResponse(BaseModel):
    logged_in: int
    logged_in_today: int
    total_users: int
    paid_users: int
    new_accounts_7d: int
    public_decks: int
    host: HostMetrics
    activity_range: ActivityRange
    activity: list[ActivityPoint]


@router.get("/analytics", response_model=AdminAnalyticsResponse)
def get_admin_analytics(
    range: ActivityRange = Query(default="week"),
    _admin_id: int = Depends(get_current_admin_user_id),
):
    """
    Admin-only snapshot: logged-in users, paid subscribers, host load,
    and activity series (week / month / year).
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                overview = fetch_overview(cur)
                rows = fetch_activity_rows(cur, range)
    except (UndefinedTable, UndefinedColumn) as e:
        logger.warning("analytics schema missing: %s", e)
        raise HTTPException(
            status_code=503, detail="analytics_schema_missing"
        ) from e
    except OperationalError as e:
        logger.warning("db error on admin analytics: %s", e)
        raise HTTPException(
            status_code=503, detail="database_unavailable"
        ) from e

    host_raw: dict[str, Any] = host_sampler.snapshot()
    points = fill_activity_points(rows, range_key=range)
    return AdminAnalyticsResponse(
        **overview,
        host=HostMetrics(**host_raw),
        activity_range=range,
        activity=[ActivityPoint(**p) for p in points],
    )
