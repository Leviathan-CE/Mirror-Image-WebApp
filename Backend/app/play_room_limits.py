"""Sliding-window limits for play-room probe and flood surfaces.

Process-local (same constraint as in-memory rooms). Tests call
``reset_play_room_limits``.
"""

from __future__ import annotations

import time
from collections import defaultdict

# 1 MiB — fog with signed art URLs can be large; still far below uvicorn's 16 MiB.
WS_MAX_BYTES = 1_048_576
WS_AUTH_TIMEOUT_S = 5.0

GET_WINDOW_S = 60.0
GET_MAX = 20
WS_IP_WINDOW_S = 60.0
WS_IP_MAX = 40
WS_USER_WINDOW_S = 60.0
WS_USER_MAX = 20
SNAPSHOT_MIN_S = 2.0

_get_hits: dict[str, list[float]] = defaultdict(list)
_ws_ip_hits: dict[str, list[float]] = defaultdict(list)
_ws_user_hits: dict[str, list[float]] = defaultdict(list)
_snapshot_at: dict[str, float] = {}


def reset_play_room_limits() -> None:
    _get_hits.clear()
    _ws_ip_hits.clear()
    _ws_user_hits.clear()
    _snapshot_at.clear()


def _allow(
    buckets: dict[str, list[float]],
    key: str,
    window_s: float,
    max_n: int,
) -> bool:
    now = time.monotonic()
    kept = [stamp for stamp in buckets[key] if now - stamp < window_s]
    if len(kept) >= max_n:
        buckets[key] = kept
        return False
    kept.append(now)
    buckets[key] = kept
    return True


def allow_room_get(user_id: int) -> bool:
    return _allow(_get_hits, f"u:{user_id}", GET_WINDOW_S, GET_MAX)


def allow_ws_handshake(ip: str) -> bool:
    return _allow(_ws_ip_hits, ip or "unknown", WS_IP_WINDOW_S, WS_IP_MAX)


def allow_ws_connect(user_id: int) -> bool:
    return _allow(_ws_user_hits, f"u:{user_id}", WS_USER_WINDOW_S, WS_USER_MAX)


def allow_snapshot(room_code: str, seat: str) -> bool:
    key = f"{room_code}:{seat}"
    now = time.monotonic()
    last = _snapshot_at.get(key, 0.0)
    if now - last < SNAPSHOT_MIN_S:
        return False
    _snapshot_at[key] = now
    return True
