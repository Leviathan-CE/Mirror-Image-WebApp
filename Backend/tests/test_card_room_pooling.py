"""
Regression test: playtest-room pooling must stay scoped to Resource tokens.

`GET /cards/library?room=CODE` pools the seated players' publish entitlements
so both sides can spawn the opening Resource pips — but only for
`super_type=Resource`. A locked (non-subscriber) seat must not gain preview
access to the rest of the catalogue just by sitting across from a peer whose
entitlement is more permissive.
"""

from __future__ import annotations

import random

import pytest
from fastapi.testclient import TestClient

from app.deck_defaults import DEFAULT_DECK_CATEGORY_NAMES
from app.play_rooms_state import reset_play_rooms


@pytest.fixture
def created_deck(client: TestClient, auth_headers: dict[str, str]) -> dict:
    """Create a private deck for the test, delete it afterward."""
    response = client.post(
        "/decks",
        headers=auth_headers,
        json={
            "name": "Pytest Pooling Deck",
            "description": "temporary test deck",
            "is_public": False,
            "start_sections": list(DEFAULT_DECK_CATEGORY_NAMES),
        },
    )
    assert response.status_code == 201, response.text
    deck = response.json()
    yield deck
    client.delete(f"/decks/{deck['id']}", headers=auth_headers)


@pytest.fixture
def preview_character_card(client: TestClient, admin_headers: dict[str, str]):
    """A freshly created, preview-gated, non-Resource catalogue card."""
    card_id = random.randint(900_000_000, 999_999_999)
    unique_name = f"Pooling Regression {card_id}"

    created = client.post(
        "/cards/",
        headers=admin_headers,
        json={
            "id": card_id,
            "card_name": unique_name,
            "super_types": ["Character"],
        },
    )
    assert created.status_code == 201, created.text

    bulk = client.patch(
        "/cards/admin/bulk",
        headers=admin_headers,
        json={"card_ids": [card_id], "published": "preview"},
    )
    assert bulk.status_code == 200, bulk.text

    yield card_id, unique_name

    client.post(
        "/cards/admin/delete", headers=admin_headers, json={"card_ids": [card_id]}
    )


def test_locked_seat_cannot_pool_preview_cards_outside_resource(
    client: TestClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    admin_headers: dict[str, str],
    created_deck: dict,
    preview_character_card: tuple[int, str],
):
    card_id, unique_name = preview_character_card
    reset_play_rooms()

    guest_id = client.get("/auth/me", headers=other_auth_headers).json()["id"]
    guest_token = other_auth_headers["Authorization"].split(" ", 1)[1]

    # Grant the guest seat preview access; the host stays a locked account.
    grant = client.patch(
        f"/admin/users/{guest_id}",
        headers=admin_headers,
        json={"feature_keys": ["preview_cards"]},
    )
    assert grant.status_code == 200, grant.text

    room = client.post(
        "/play/rooms", json={"deck_id": created_deck["id"]}, headers=auth_headers
    )
    assert room.status_code == 200, room.text
    code = room.json()["code"]

    try:
        # Outside any room the locked host must not see the preview card.
        outside = client.get(
            "/cards/library", params={"q": unique_name}, headers=auth_headers
        )
        assert outside.status_code == 200
        assert all(item["id"] != card_id for item in outside.json()["items"])

        with client.websocket_connect(f"/play/ws/rooms/{code}") as guest:
            guest.send_json({"type": "auth", "token": guest_token})
            assert guest.receive_json()["seat"] == "p2"

            # Same locked host, now seated with a preview-entitled peer, asks
            # for a non-Resource super_type: pooling must NOT leak preview
            # cards from outside the Resource catalogue.
            gated = client.get(
                "/cards/library",
                params={"room": code, "q": unique_name, "super_type": "Character"},
                headers=auth_headers,
            )
            assert gated.status_code == 200, gated.text
            assert all(item["id"] != card_id for item in gated.json()["items"])

            # Same query with no super_type filter at all must also stay gated.
            gated_unfiltered = client.get(
                "/cards/library",
                params={"room": code, "q": unique_name},
                headers=auth_headers,
            )
            assert gated_unfiltered.status_code == 200, gated_unfiltered.text
            assert all(
                item["id"] != card_id for item in gated_unfiltered.json()["items"]
            )
    finally:
        client.patch(
            f"/admin/users/{guest_id}",
            headers=admin_headers,
            json={"feature_keys": []},
        )
        reset_play_rooms()


def test_room_pooling_still_unlocks_resource_tokens(
    client: TestClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
    admin_headers: dict[str, str],
    created_deck: dict,
):
    """Sanity check that the fix did not also break the intended Resource pool."""
    reset_play_rooms()

    resource_id = random.randint(900_000_000, 999_999_999)
    unique_name = f"Pooling Resource {resource_id}"
    guest_id = client.get("/auth/me", headers=other_auth_headers).json()["id"]
    guest_token = other_auth_headers["Authorization"].split(" ", 1)[1]

    created = client.post(
        "/cards/",
        headers=admin_headers,
        json={
            "id": resource_id,
            "card_name": unique_name,
            "super_types": ["Resource"],
        },
    )
    assert created.status_code == 201, created.text
    bulk = client.patch(
        "/cards/admin/bulk",
        headers=admin_headers,
        json={"card_ids": [resource_id], "published": "preview"},
    )
    assert bulk.status_code == 200, bulk.text

    grant = client.patch(
        f"/admin/users/{guest_id}",
        headers=admin_headers,
        json={"feature_keys": ["preview_cards"]},
    )
    assert grant.status_code == 200, grant.text

    room = client.post(
        "/play/rooms", json={"deck_id": created_deck["id"]}, headers=auth_headers
    )
    assert room.status_code == 200, room.text
    code = room.json()["code"]

    try:
        with client.websocket_connect(f"/play/ws/rooms/{code}") as guest:
            guest.send_json({"type": "auth", "token": guest_token})
            assert guest.receive_json()["seat"] == "p2"

            pooled = client.get(
                "/cards/library",
                params={"room": code, "q": unique_name, "super_type": "Resource"},
                headers=auth_headers,
            )
            assert pooled.status_code == 200, pooled.text
            assert any(item["id"] == resource_id for item in pooled.json()["items"])
    finally:
        client.patch(
            f"/admin/users/{guest_id}",
            headers=admin_headers,
            json={"feature_keys": []},
        )
        client.post(
            "/cards/admin/delete", headers=admin_headers, json={"card_ids": [resource_id]}
        )
        reset_play_rooms()
