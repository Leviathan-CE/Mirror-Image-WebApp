"""Registry for the in-memory playtester rooms.

Lives outside the router so non-play routes (deck reads) can ask who is
seated where without importing an APIRouter.

Rooms live in this process. Run a **single uvicorn worker** until Redis
is added — a second worker cannot see these rooms.
"""

from __future__ import annotations

import asyncio
import secrets
import string
import time
from dataclasses import dataclass, field
from typing import Literal

from fastapi import HTTPException, WebSocket

CODE_ALPHABET = string.ascii_uppercase + string.digits
CODE_LEN = 6
ROOM_TTL_SEC = 30 * 60
Seat = Literal["p1", "p2"]


class RoomSeat:
    def __init__(self, user_id: int, deck_id: int | None = None) -> None:
        self.user_id = user_id
        self.deck_id = deck_id
        self.ws: WebSocket | None = None


@dataclass
class PlayRoom:
    code: str
    host_user_id: int
    created_at: float
    seats: dict[Seat, RoomSeat | None] = field(
        default_factory=lambda: {"p1": None, "p2": None}
    )

    def expired(self, now: float | None = None) -> bool:
        return (now or time.time()) - self.created_at > ROOM_TTL_SEC

    def occupied_seats(self) -> list[RoomSeat]:
        return [holder for holder in self.seats.values() if holder is not None]

    def member_ids(self) -> tuple[int, ...]:
        """Seated user ids, deduped, in seat order."""
        seen: list[int] = []
        for holder in self.occupied_seats():
            if holder.user_id not in seen:
                seen.append(holder.user_id)
        return tuple(seen)


_rooms: dict[str, PlayRoom] = {}
_user_room: dict[int, str] = {}

# Held while seating players so two sockets cannot claim the same seat.
lock = asyncio.Lock()


def reset_play_rooms() -> None:
    """Test helper — drop every in-memory room."""
    _rooms.clear()
    _user_room.clear()


def purge_expired() -> None:
    now = time.time()
    # Snapshot first — deck reads land on a threadpool thread and may register
    # a room while this runs.
    dead = [code for code, room in list(_rooms.items()) if room.expired(now)]
    for code in dead:
        room = _rooms.pop(code, None)
        if not room:
            continue
        for holder in room.occupied_seats():
            _user_room.pop(holder.user_id, None)


def new_code() -> str:
    for _ in range(32):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LEN))
        if code not in _rooms:
            return code
    raise HTTPException(status_code=500, detail="room_code_exhausted")


def live_room(code: str | None) -> PlayRoom | None:
    """Room for ``code`` if it exists and has not aged out."""
    if not code:
        return None
    purge_expired()
    room = _rooms.get(code.strip().upper())
    if room is None or room.expired():
        return None
    return room


def code_for_user(user_id: int) -> str | None:
    return _user_room.get(user_id)


def room_for_user(user_id: int) -> PlayRoom | None:
    """The live room this user is seated in, if any."""
    return live_room(_user_room.get(user_id))


def register_room(room: PlayRoom) -> None:
    _rooms[room.code] = room


def remember_user(user_id: int, code: str) -> None:
    _user_room[user_id] = code


def forget_user(user_id: int) -> None:
    _user_room.pop(user_id, None)
