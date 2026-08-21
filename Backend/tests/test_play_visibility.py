"""Playtest-room visibility pooling — no Postgres required."""

from __future__ import annotations

import time

from app.play_rooms_state import (
    ROOM_TTL_SEC,
    PlayRoom,
    RoomSeat,
    register_room,
    reset_play_rooms,
)
from app.play_visibility import (
    UserEntitlement,
    pooled_publish_gate,
    resolve_room_visibility,
    room_pool_facts,
)

HOST_ID = 1
GUEST_ID = 2
HOST_DECK = 10
GUEST_DECK = 20


class _FakeCursor:
    """Answers the three queries the resolver makes, keyed on the table."""

    def __init__(
        self,
        *,
        users: dict[int, tuple[str, str]],
        grants: dict[int, list[str]] | None = None,
        deck_owners: dict[int, int] | None = None,
    ) -> None:
        self.users = users
        self.grants = grants or {}
        self.deck_owners = deck_owners or {}
        self._result: list[tuple] = []

    def execute(self, sql: str, params: dict | None = None) -> None:
        args = params or {}
        if "FROM users" in sql:
            row = self.users.get(int(args["user_id"]))
            self._result = [row] if row else []
        elif "user_feature_grants" in sql:
            self._result = [(key,) for key in self.grants.get(int(args["user_id"]), [])]
        elif "user_has_decks" in sql:
            owner = self.deck_owners.get(int(args["deck_id"]))
            self._result = [(owner,)] if owner is not None else []
        else:  # pragma: no cover - guards against a silently wrong query
            raise AssertionError(f"unexpected query: {sql}")

    def fetchone(self) -> tuple | None:
        return self._result[0] if self._result else None

    def fetchall(self) -> list[tuple]:
        return list(self._result)


def _seated_room(
    *,
    code: str = "ABC123",
    guest: bool = True,
    guest_deck: int | None = GUEST_DECK,
    age_sec: float = 0.0,
) -> PlayRoom:
    reset_play_rooms()
    room = PlayRoom(
        code=code, host_user_id=HOST_ID, created_at=time.time() - age_sec
    )
    room.seats["p1"] = RoomSeat(user_id=HOST_ID, deck_id=HOST_DECK)
    if guest:
        room.seats["p2"] = RoomSeat(user_id=GUEST_ID, deck_id=guest_deck)
    register_room(room)
    return room


def _cursor(
    *,
    host: tuple[str, str] = ("user", "none"),
    guest: tuple[str, str] = ("user", "none"),
    grants: dict[int, list[str]] | None = None,
) -> _FakeCursor:
    return _FakeCursor(
        users={HOST_ID: host, GUEST_ID: guest},
        grants=grants,
        deck_owners={HOST_DECK: HOST_ID, GUEST_DECK: GUEST_ID},
    )


def test_gate_is_locked_when_no_seat_is_entitled() -> None:
    locked = UserEntitlement(is_admin=False, include_preview=False)
    assert pooled_publish_gate([locked, locked]) == (False, False)


def test_gate_takes_the_more_permissive_seat() -> None:
    locked = UserEntitlement(is_admin=False, include_preview=False)
    subscriber = UserEntitlement(is_admin=False, include_preview=True)
    admin = UserEntitlement(is_admin=True, include_preview=True)

    assert pooled_publish_gate([locked, subscriber]) == (False, True)
    assert pooled_publish_gate([locked, admin]) == (True, True)


def test_facts_reject_a_non_member() -> None:
    room = _seated_room()
    assert room_pool_facts(room, deck_id=HOST_DECK, user_id=99) is None


def test_facts_reject_a_deck_nobody_seated() -> None:
    room = _seated_room()
    assert room_pool_facts(room, deck_id=777, user_id=HOST_ID) is None


def test_facts_name_the_opponent_holding_the_deck() -> None:
    room = _seated_room()

    own = room_pool_facts(room, deck_id=HOST_DECK, user_id=HOST_ID)
    assert own is not None
    assert own.member_ids == (HOST_ID, GUEST_ID)
    assert own.peer_ids == ()

    across = room_pool_facts(room, deck_id=GUEST_DECK, user_id=HOST_ID)
    assert across is not None
    assert across.peer_ids == (GUEST_ID,)


def test_admin_opponent_unlocks_unpublished_cards_for_a_plain_user() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(host=("admin", "none")),
        code="ABC123",
        deck_id=GUEST_DECK,
        user_id=GUEST_ID,
    )

    assert pooled is not None
    assert pooled.bypass is True


def test_subscriber_opponent_unlocks_preview_cards_only() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(host=("user", "active")),
        code="ABC123",
        deck_id=GUEST_DECK,
        user_id=GUEST_ID,
    )

    assert pooled is not None
    assert pooled.bypass is False
    assert pooled.include_preview is True


def test_two_locked_players_stay_locked() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(), code="ABC123", deck_id=GUEST_DECK, user_id=GUEST_ID
    )

    assert pooled is not None
    assert pooled.bypass is False
    assert pooled.include_preview is False


def test_opponent_may_read_the_private_deck_across_the_table() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(), code="ABC123", deck_id=GUEST_DECK, user_id=HOST_ID
    )

    assert pooled is not None
    assert pooled.allow_private is True


def test_seating_a_stranger_deck_does_not_open_it() -> None:
    """Alone in a room, claiming deck 20 must not grant read on deck 20."""
    reset_play_rooms()
    room = PlayRoom(code="ABC123", host_user_id=HOST_ID, created_at=time.time())
    room.seats["p1"] = RoomSeat(user_id=HOST_ID, deck_id=GUEST_DECK)
    register_room(room)

    pooled = resolve_room_visibility(
        _cursor(), code="ABC123", deck_id=GUEST_DECK, user_id=HOST_ID
    )

    assert pooled is not None
    assert pooled.allow_private is False
    assert pooled.bypass is False


def test_own_deck_read_needs_no_private_bypass() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(), code="ABC123", deck_id=HOST_DECK, user_id=HOST_ID
    )

    assert pooled is not None
    assert pooled.allow_private is False


def test_pooling_is_skipped_outside_a_live_room() -> None:
    _seated_room()
    cur = _cursor(host=("admin", "none"))

    assert resolve_room_visibility(
        cur, code=None, deck_id=GUEST_DECK, user_id=GUEST_ID
    ) is None
    assert resolve_room_visibility(
        cur, code="NOPE12", deck_id=GUEST_DECK, user_id=GUEST_ID
    ) is None
    assert resolve_room_visibility(
        cur, code="ABC123", deck_id=GUEST_DECK, user_id=None
    ) is None
    assert resolve_room_visibility(
        cur, code="ABC123", deck_id=GUEST_DECK, user_id=99
    ) is None


def test_pooling_expires_with_the_room() -> None:
    _seated_room(age_sec=ROOM_TTL_SEC + 60)

    assert resolve_room_visibility(
        _cursor(host=("admin", "none")),
        code="ABC123",
        deck_id=GUEST_DECK,
        user_id=GUEST_ID,
    ) is None


def test_room_code_is_normalized() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(host=("admin", "none")),
        code=" abc123 ",
        deck_id=GUEST_DECK,
        user_id=GUEST_ID,
    )

    assert pooled is not None
    assert pooled.bypass is True


def test_grant_on_either_seat_unlocks_preview() -> None:
    _seated_room()
    pooled = resolve_room_visibility(
        _cursor(grants={HOST_ID: ["preview_cards"]}),
        code="ABC123",
        deck_id=GUEST_DECK,
        user_id=GUEST_ID,
    )

    assert pooled is not None
    assert pooled.include_preview is True
