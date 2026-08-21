"""Card visibility pooling inside a playtest room.

A designer needs to playtest unreleased cards against someone who cannot see
them yet. Inside a live two-seat room the publish gate therefore becomes the
**union** of the seated players' entitlements: if either side may see a preview
or unpublished card, both do.

The scope is deliberately narrow, because pooling is an entitlement bypass:

- only decks **seated in a room the caller sits in** (never `/cards/*`),
- only while that room is live (30 min TTL),
- private decks open up only for the deck's **actual owner's opponent**, so
  seating a stranger's deck id cannot be used to read it.

Rooms are process-local (see `app.play_rooms_state`) — single worker only.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass

from app.features import FEATURE_PREVIEW_CARDS, load_granted_feature_keys, user_has_feature
from app.play_rooms_state import PlayRoom, live_room


@dataclass(frozen=True)
class UserEntitlement:
    """What one account may see in the catalogue."""

    is_admin: bool
    include_preview: bool


@dataclass(frozen=True)
class RoomVisibility:
    """Pooled gate for a single deck read made from inside a room."""

    bypass: bool
    include_preview: bool
    allow_private: bool


@dataclass(frozen=True)
class PoolCandidate:
    """Who is seated, and who put the requested deck on the table."""

    member_ids: tuple[int, ...]
    # Members other than the caller seated with the requested deck. Empty when
    # the caller is asking about their own seat.
    peer_ids: tuple[int, ...]


def room_pool_facts(
    room: PlayRoom, *, deck_id: int, user_id: int
) -> PoolCandidate | None:
    """
    Seating facts for a pooled read, or None when pooling does not apply.

    None when the caller is not seated in ``room``, or when ``deck_id`` is not
    the deck either seat brought.
    """
    seats = room.occupied_seats()
    if not any(holder.user_id == user_id for holder in seats):
        return None
    holders = [holder for holder in seats if holder.deck_id == deck_id]
    if not holders:
        return None
    return PoolCandidate(
        member_ids=room.member_ids(),
        peer_ids=tuple(
            {holder.user_id for holder in holders if holder.user_id != user_id}
        ),
    )


def pooled_publish_gate(
    entitlements: Iterable[UserEntitlement],
) -> tuple[bool, bool]:
    """``(bypass, include_preview)`` — the most permissive seat wins."""
    bypass = False
    include_preview = False
    for entitlement in entitlements:
        bypass = bypass or entitlement.is_admin
        include_preview = include_preview or entitlement.include_preview
    return bypass, include_preview


def load_user_entitlement(cur, user_id: int) -> UserEntitlement:
    """Live role / subscription / grants for one account (never the JWT)."""
    cur.execute(
        """
        SELECT role, subscription_status
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    row = cur.fetchone()
    if row is None:
        return UserEntitlement(is_admin=False, include_preview=False)

    role = row[0] or "user"
    sub_status = row[1] or "none"
    granted = load_granted_feature_keys(cur, user_id)
    return UserEntitlement(
        is_admin=role == "admin",
        include_preview=user_has_feature(
            role=role,
            subscription_status=sub_status,
            granted_keys=granted,
            feature_key=FEATURE_PREVIEW_CARDS,
        ),
    )


def deck_owner_id(cur, deck_id: int) -> int | None:
    cur.execute(
        """
        SELECT user_id
          FROM user_has_decks
         WHERE deck_id = %(deck_id)s
         LIMIT 1
        """,
        {"deck_id": deck_id},
    )
    row = cur.fetchone()
    return int(row[0]) if row else None


def resolve_room_visibility(
    cur, *, code: str | None, deck_id: int, user_id: int | None
) -> RoomVisibility | None:
    """
    Pooled gate for `GET /decks/{id}?room=CODE`, or None when it does not apply.

    Fails soft on purpose: an unknown, expired, or foreign room code just
    reverts to the caller's own entitlement instead of erroring, so a stale
    code in a URL cannot stop a deck from loading.
    """
    if not code or user_id is None or deck_id <= 0:
        return None
    room = live_room(code)
    if room is None:
        return None
    facts = room_pool_facts(room, deck_id=deck_id, user_id=user_id)
    if facts is None:
        return None

    bypass, include_preview = pooled_publish_gate(
        load_user_entitlement(cur, member_id) for member_id in facts.member_ids
    )
    # Reading past `is_public` is only for the deck your opponent is actually
    # playing — seating someone else's deck id must not unlock it.
    allow_private = bool(facts.peer_ids) and deck_owner_id(cur, deck_id) in facts.peer_ids
    return RoomVisibility(
        bypass=bypass,
        include_preview=include_preview,
        allow_private=allow_private,
    )
