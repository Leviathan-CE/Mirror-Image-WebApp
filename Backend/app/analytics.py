"""App analytics: daily activity buckets, last-seen, host resource samples."""

from __future__ import annotations

import logging
import threading
import time
from collections import deque
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal

from psycopg2 import OperationalError
from psycopg2.errors import UndefinedColumn, UndefinedTable

from app.db import get_connection
from app.subscription import ENTITLED_STATUSES

logger = logging.getLogger(__name__)

ActivityRange = Literal["week", "month", "year"]
ONLINE_WINDOW = timedelta(minutes=15)
LAST_SEEN_THROTTLE = timedelta(minutes=2)
HOST_SAMPLE_INTERVAL_SEC = 15.0
HOST_SAMPLE_HISTORY = 240  # 15s × 240 ≈ 1 hour

SKIP_PATH_PREFIXES = (
    "/health",
    "/admin/analytics",
    "/docs",
    "/openapi.json",
    "/redoc",
)

LOGIN_PATHS = frozenset({"/auth/login", "/auth/google"})


def utc_today() -> date:
    return datetime.now(UTC).date()


def peek_user_id_from_authorization(header: str | None) -> int | None:
    """Best-effort JWT subject — never raises (analytics must not fail requests)."""
    if not header:
        return None
    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    try:
        from app.security import signing_secret, ALGORITHM

        import jwt

        payload = jwt.decode(
            parts[1],
            signing_secret(),
            algorithms=[ALGORITHM],
            options={"verify_exp": True},
        )
        return int(payload["sub"])
    except Exception:
        return None


def should_skip_path(path: str) -> bool:
    return any(path == p or path.startswith(p + "/") for p in SKIP_PATH_PREFIXES)


def record_http_activity(
    *,
    user_id: int | None,
    is_login: bool = False,
) -> None:
    """Increment today's UTC bucket; stamp last_seen and unique users when authed."""
    login_inc = 1 if is_login else 0
    today = utc_today()
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO analytics_daily (
                        day, request_count, unique_users, login_count
                    )
                    VALUES (%(day)s, 1, 0, %(login)s)
                    ON CONFLICT (day) DO UPDATE SET
                        request_count = analytics_daily.request_count + 1,
                        login_count = analytics_daily.login_count + %(login)s
                    """,
                    {"day": today, "login": login_inc},
                )
                if user_id is not None:
                    _touch_last_seen(cur, user_id=user_id, today=today)
            conn.commit()
    except (OperationalError, UndefinedTable, UndefinedColumn) as exc:
        logger.debug("analytics record skipped: %s", exc)


def _touch_last_seen(cur, *, user_id: int, today: date) -> None:
    cur.execute(
        """
        WITH prev AS (
            SELECT id, last_seen_at
              FROM users
             WHERE id = %(user_id)s
             FOR UPDATE
        )
        UPDATE users u
           SET last_seen_at = NOW()
          FROM prev
         WHERE u.id = prev.id
           AND (
                prev.last_seen_at IS NULL
                OR prev.last_seen_at < NOW() - %(throttle)s
                OR (prev.last_seen_at AT TIME ZONE 'utc')::date < %(today)s
           )
     RETURNING (
                prev.last_seen_at IS NULL
                OR (prev.last_seen_at AT TIME ZONE 'utc')::date < %(today)s
               ) AS first_today
        """,
        {
            "user_id": user_id,
            "today": today,
            "throttle": LAST_SEEN_THROTTLE,
        },
    )
    row = cur.fetchone()
    if row and row[0]:
        cur.execute(
            """
            UPDATE analytics_daily
               SET unique_users = unique_users + 1
             WHERE day = %(today)s
            """,
            {"today": today},
        )


def fill_activity_points(
    rows: dict[date, tuple[int, int, int]],
    *,
    range_key: ActivityRange,
    today: date | None = None,
) -> list[dict[str, Any]]:
    """Fill missing days/months with zeros. rows: date → (unique, requests, logins)."""
    today = today or utc_today()
    points: list[dict[str, Any]] = []
    if range_key == "year":
        start = date(today.year, today.month, 1)
        months: list[date] = []
        cursor = start
        for _ in range(12):
            months.append(cursor)
            year, month = (cursor.year - 1, 12) if cursor.month == 1 else (
                cursor.year,
                cursor.month - 1,
            )
            cursor = date(year, month, 1)
        months.reverse()
        by_month = rows
        for month_start in months:
            unique, requests, logins = by_month.get(month_start, (0, 0, 0))
            points.append(
                {
                    "label": month_start.strftime("%Y-%m"),
                    "unique_users": unique,
                    "requests": requests,
                    "logins": logins,
                }
            )
        return points

    days = 7 if range_key == "week" else 30
    start = today - timedelta(days=days - 1)
    cursor = start
    while cursor <= today:
        unique, requests, logins = rows.get(cursor, (0, 0, 0))
        points.append(
            {
                "label": cursor.isoformat(),
                "unique_users": unique,
                "requests": requests,
                "logins": logins,
            }
        )
        cursor += timedelta(days=1)
    return points


def fetch_activity_rows(cur, range_key: ActivityRange) -> dict[date, tuple[int, int, int]]:
    if range_key == "year":
        cur.execute(
            """
            SELECT date_trunc('month', day)::date AS month,
                   COALESCE(SUM(unique_users), 0)::int,
                   COALESCE(SUM(request_count), 0)::bigint,
                   COALESCE(SUM(login_count), 0)::int
              FROM analytics_daily
             WHERE day >= (
                    date_trunc('month', (NOW() AT TIME ZONE 'utc')::date)
                    - INTERVAL '11 months'
                   )::date
             GROUP BY 1
             ORDER BY 1
            """
        )
        return {
            row[0]: (int(row[1] or 0), int(row[2] or 0), int(row[3] or 0))
            for row in cur.fetchall()
        }

    days = 7 if range_key == "week" else 30
    cur.execute(
        """
        SELECT day,
               unique_users,
               request_count,
               login_count
          FROM analytics_daily
         WHERE day >= ((NOW() AT TIME ZONE 'utc')::date - %(span)s)
         ORDER BY day
        """,
        {"span": timedelta(days=days - 1)},
    )
    return {
        row[0]: (int(row[1] or 0), int(row[2] or 0), int(row[3] or 0))
        for row in cur.fetchall()
    }


def fetch_overview(cur) -> dict[str, int]:
    entitled = tuple(sorted(ENTITLED_STATUSES))
    cur.execute(
        """
        SELECT
          COUNT(*) FILTER (
            WHERE is_active
              AND last_seen_at IS NOT NULL
              AND last_seen_at > NOW() - %(online)s
          )::int AS logged_in,
          COUNT(*) FILTER (
            WHERE is_active
              AND last_seen_at IS NOT NULL
              AND (last_seen_at AT TIME ZONE 'utc')::date
                  = (NOW() AT TIME ZONE 'utc')::date
          )::int AS logged_in_today,
          COUNT(*) FILTER (WHERE is_active)::int AS total_users,
          COUNT(*) FILTER (
            WHERE is_active
              AND subscription_status IN %(entitled)s
          )::int AS paid_users,
          COUNT(*) FILTER (
            WHERE created_at >= NOW() - INTERVAL '7 days'
          )::int AS new_accounts_7d
        FROM users
        """,
        {"online": ONLINE_WINDOW, "entitled": entitled},
    )
    row = cur.fetchone() or (0, 0, 0, 0, 0)
    cur.execute(
        """
        SELECT COUNT(*)::int
          FROM user_has_decks
         WHERE is_public = TRUE
        """
    )
    public = cur.fetchone()
    return {
        "logged_in": int(row[0] or 0),
        "logged_in_today": int(row[1] or 0),
        "total_users": int(row[2] or 0),
        "paid_users": int(row[3] or 0),
        "new_accounts_7d": int(row[4] or 0),
        "public_decks": int(public[0] if public else 0),
    }


class HostSampler:
    """Background CPU / memory / network samples of this API process's host view."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._samples: deque[dict[str, float]] = deque(maxlen=HOST_SAMPLE_HISTORY)
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._prev_net: tuple[int, int, float] | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run, name="host-sampler", daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()

    def snapshot(self) -> dict[str, float | int | None]:
        with self._lock:
            samples = list(self._samples)
        latest = samples[-1] if samples else None

        def avg(key: str) -> float | None:
            if not samples:
                return None
            return sum(s[key] for s in samples) / len(samples)

        return {
            "cpu_pct": latest["cpu_pct"] if latest else None,
            "cpu_avg_pct": avg("cpu_pct"),
            "memory_pct": latest["memory_pct"] if latest else None,
            "memory_avg_pct": avg("memory_pct"),
            "memory_used_bytes": int(latest["memory_used"]) if latest else None,
            "memory_total_bytes": int(latest["memory_total"]) if latest else None,
            "net_recv_bps": latest["net_recv_bps"] if latest else None,
            "net_sent_bps": latest["net_sent_bps"] if latest else None,
            "net_recv_avg_bps": avg("net_recv_bps"),
            "net_sent_avg_bps": avg("net_sent_bps"),
            "sample_count": len(samples),
        }

    def _run(self) -> None:
        try:
            import psutil
        except ImportError:
            logger.warning("psutil not installed — host metrics disabled")
            return

        psutil.cpu_percent(interval=None)
        while not self._stop.wait(HOST_SAMPLE_INTERVAL_SEC):
            try:
                sample = self._read(psutil)
            except Exception as exc:
                logger.debug("host sample failed: %s", exc)
                continue
            with self._lock:
                self._samples.append(sample)

    def _read(self, psutil) -> dict[str, float]:
        cpu = float(psutil.cpu_percent(interval=None))
        mem = psutil.virtual_memory()
        net = psutil.net_io_counters()
        now = time.monotonic()
        recv_bps = 0.0
        sent_bps = 0.0
        if self._prev_net is not None:
            prev_recv, prev_sent, prev_t = self._prev_net
            dt = max(now - prev_t, 0.001)
            recv_bps = max(0.0, (net.bytes_recv - prev_recv) / dt)
            sent_bps = max(0.0, (net.bytes_sent - prev_sent) / dt)
        self._prev_net = (int(net.bytes_recv), int(net.bytes_sent), now)
        return {
            "cpu_pct": cpu,
            "memory_pct": float(mem.percent),
            "memory_used": float(mem.used),
            "memory_total": float(mem.total),
            "net_recv_bps": recv_bps,
            "net_sent_bps": sent_bps,
        }


host_sampler = HostSampler()
