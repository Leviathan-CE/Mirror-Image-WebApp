"""
Integration tests for the deck builder API.

Requires Postgres + seed users (and at least one card for card-mutation tests).
Skipped automatically when the database is unavailable.
"""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def created_deck(client: TestClient, auth_headers: dict[str, str]) -> dict:
    """Create a private deck for the test, delete it afterward."""
    response = client.post(
        "/decks",
        headers=auth_headers,
        json={
            "name": "Pytest Deck",
            "description": "temporary test deck",
            "is_public": False,
        },
    )
    assert response.status_code == 201, response.text
    deck = response.json()
    yield deck
    client.delete(f"/decks/{deck['id']}", headers=auth_headers)


def test_list_default_categories_no_auth(client: TestClient):
    response = client.get("/decks/default-categories")
    assert response.status_code == 200
    body = response.json()
    assert body["categories"] == ["Main", "Side", "Maybe", "Extra"]


def test_new_deck_seeds_default_categories(
    client: TestClient, auth_headers: dict[str, str], created_deck: dict
):
    response = client.get(
        f"/decks/{created_deck['id']}/categories",
        headers=auth_headers,
    )
    assert response.status_code == 200
    names = [c["name"] for c in response.json()]
    assert names == ["Main", "Side", "Maybe", "Extra"]


def test_create_deck_requires_auth(client: TestClient, require_db: None):
    response = client.post(
        "/decks",
        json={"name": "No Auth", "is_public": True},
    )
    assert response.status_code == 401


def test_create_and_list_my_decks(
    client: TestClient, auth_headers: dict[str, str], created_deck: dict
):
    assert created_deck["name"] == "Pytest Deck"
    assert created_deck["is_public"] is False
    assert created_deck["author_name"]
    assert created_deck["card_count"] == 0

    mine = client.get("/decks/me", headers=auth_headers)
    assert mine.status_code == 200
    ids = {d["id"] for d in mine.json()}
    assert created_deck["id"] in ids


def test_private_deck_not_visible_to_anonymous(
    client: TestClient, created_deck: dict
):
    response = client.get(f"/decks/{created_deck['id']}")
    assert response.status_code == 404
    assert response.json()["detail"] == "deck_not_found"


def test_private_deck_not_visible_to_other_user(
    client: TestClient,
    created_deck: dict,
    other_auth_headers: dict[str, str],
):
    response = client.get(
        f"/decks/{created_deck['id']}",
        headers=other_auth_headers,
    )
    assert response.status_code == 404


def test_owner_can_read_private_deck(
    client: TestClient, auth_headers: dict[str, str], created_deck: dict
):
    response = client.get(f"/decks/{created_deck['id']}", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created_deck["id"]
    assert body["cards"] == []


def test_public_deck_readable_without_auth(
    client: TestClient, auth_headers: dict[str, str]
):
    created = client.post(
        "/decks",
        headers=auth_headers,
        json={"name": "Public Pytest Deck", "is_public": True},
    )
    assert created.status_code == 201
    deck_id = created.json()["id"]

    try:
        anon = client.get(f"/decks/{deck_id}")
        assert anon.status_code == 200
        assert anon.json()["is_public"] is True
        assert anon.json()["name"] == "Public Pytest Deck"

        catalogue = client.get("/decks/public")
        assert catalogue.status_code == 200
        page = catalogue.json()
        assert "items" in page
        assert any(d["id"] == deck_id for d in page["items"])
        assert isinstance(page["total"], int)

        cards = client.get(f"/decks/{deck_id}/cards")
        assert cards.status_code == 200
        assert cards.json() == []
    finally:
        client.delete(f"/decks/{deck_id}", headers=auth_headers)


def test_anonymous_cannot_edit_public_deck(
    client: TestClient, auth_headers: dict[str, str]
):
    created = client.post(
        "/decks",
        headers=auth_headers,
        json={"name": "Locked Public", "is_public": True},
    )
    deck_id = created.json()["id"]

    try:
        patch = client.patch(
            f"/decks/{deck_id}",
            json={"name": "Hacked"},
        )
        assert patch.status_code == 401

        add = client.post(
            f"/decks/{deck_id}/cards",
            json={"card_id": 1, "quantity": 1},
        )
        assert add.status_code == 401
    finally:
        client.delete(f"/decks/{deck_id}", headers=auth_headers)


def test_other_user_cannot_edit_public_deck(
    client: TestClient,
    auth_headers: dict[str, str],
    other_auth_headers: dict[str, str],
):
    created = client.post(
        "/decks",
        headers=auth_headers,
        json={"name": "Owner Public", "is_public": True},
    )
    deck_id = created.json()["id"]

    try:
        # Other user can read
        view = client.get(f"/decks/{deck_id}", headers=other_auth_headers)
        assert view.status_code == 200

        # But cannot patch
        patch = client.patch(
            f"/decks/{deck_id}",
            headers=other_auth_headers,
            json={"name": "Stolen"},
        )
        assert patch.status_code == 404

        delete = client.delete(f"/decks/{deck_id}", headers=other_auth_headers)
        assert delete.status_code == 404
    finally:
        client.delete(f"/decks/{deck_id}", headers=auth_headers)


def test_owner_updates_meta_and_visibility(
    client: TestClient, auth_headers: dict[str, str], created_deck: dict
):
    deck_id = created_deck["id"]

    patched = client.patch(
        f"/decks/{deck_id}",
        headers=auth_headers,
        json={
            "name": "Pytest Deck Renamed",
            "description": "updated",
            "is_public": True,
        },
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["name"] == "Pytest Deck Renamed"
    assert body["description"] == "updated"
    assert body["is_public"] is True

    anon = client.get(f"/decks/{deck_id}")
    assert anon.status_code == 200


def test_add_reorder_update_remove_cards(
    client: TestClient,
    auth_headers: dict[str, str],
    created_deck: dict,
    sample_card_id: int,
):
    deck_id = created_deck["id"]
    cats = client.get(f"/decks/{deck_id}/categories", headers=auth_headers).json()
    by_name = {c["name"]: c["id"] for c in cats}
    main_id = by_name["Main"]
    side_id = by_name["Side"]

    added = client.post(
        f"/decks/{deck_id}/cards",
        headers=auth_headers,
        json={
            "card_id": sample_card_id,
            "quantity": 2,
            "category_id": main_id,
        },
    )
    assert added.status_code == 201, added.text
    entry = added.json()
    assert entry["card_id"] == sample_card_id
    assert entry["quantity"] == 2
    assert entry["category_id"] == main_id
    assert entry["category_name"] == "Main"

    again = client.post(
        f"/decks/{deck_id}/cards",
        headers=auth_headers,
        json={"card_id": sample_card_id, "quantity": 1, "category_id": main_id},
    )
    assert again.status_code == 201
    assert again.json()["quantity"] == 3

    reordered = client.put(
        f"/decks/{deck_id}/cards/order",
        headers=auth_headers,
        json={
            "items": [
                {
                    "card_id": sample_card_id,
                    "category_id": main_id,
                    "sort_order": 5,
                }
            ]
        },
    )
    assert reordered.status_code == 200
    assert reordered.json()[0]["sort_order"] == 5

    moved = client.patch(
        f"/decks/{deck_id}/cards/{sample_card_id}",
        headers=auth_headers,
        params={"category_id": main_id},
        json={"category_id": side_id, "quantity": 1},
    )
    assert moved.status_code == 200, moved.text
    assert moved.json()["category_id"] == side_id
    assert moved.json()["category_name"] == "Side"
    assert moved.json()["quantity"] == 1

    listed = client.get(
        f"/decks/{deck_id}/cards",
        headers=auth_headers,
        params={"category_id": side_id},
    )
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    removed = client.delete(
        f"/decks/{deck_id}/cards/{sample_card_id}",
        headers=auth_headers,
        params={"category_id": side_id},
    )
    assert removed.status_code == 204

    empty = client.get(f"/decks/{deck_id}/cards", headers=auth_headers)
    assert empty.status_code == 200
    assert empty.json() == []


def test_user_defined_category_crud(
    client: TestClient,
    auth_headers: dict[str, str],
    created_deck: dict,
    sample_card_id: int,
):
    deck_id = created_deck["id"]

    created = client.post(
        f"/decks/{deck_id}/categories",
        headers=auth_headers,
        json={"name": "Tech"},
    )
    assert created.status_code == 201, created.text
    tech = created.json()
    assert tech["name"] == "Tech"

    renamed = client.patch(
        f"/decks/{deck_id}/categories/{tech['id']}",
        headers=auth_headers,
        json={"name": "Hardcore"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "Hardcore"

    added = client.post(
        f"/decks/{deck_id}/cards",
        headers=auth_headers,
        json={"card_id": sample_card_id, "quantity": 1, "category_id": tech["id"]},
    )
    assert added.status_code == 201
    assert added.json()["category_name"] == "Hardcore"

    blocked = client.delete(
        f"/decks/{deck_id}/categories/{tech['id']}",
        headers=auth_headers,
    )
    assert blocked.status_code == 409
    assert blocked.json()["detail"] == "category_in_use"

    client.delete(
        f"/decks/{deck_id}/cards/{sample_card_id}",
        headers=auth_headers,
        params={"category_id": tech["id"]},
    )
    deleted = client.delete(
        f"/decks/{deck_id}/categories/{tech['id']}",
        headers=auth_headers,
    )
    assert deleted.status_code == 204


def test_upload_cover_image(
    client: TestClient, auth_headers: dict[str, str], created_deck: dict
):
    deck_id = created_deck["id"]
    # Minimal valid 1x1 PNG
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
        b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
        b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
        b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )

    response = client.post(
        f"/decks/{deck_id}/cover",
        headers=auth_headers,
        files={"file": ("cover.png", io.BytesIO(png), "image/png")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["deck_id"] == deck_id
    assert body["cover_image_path"].startswith(f"decks/{deck_id}/")
    assert body["cover_size_bytes"] == len(png)

    detail = client.get(f"/decks/{deck_id}", headers=auth_headers)
    assert detail.json()["cover_image_path"] == body["cover_image_path"]


def test_delete_deck(
    client: TestClient, auth_headers: dict[str, str]
):
    created = client.post(
        "/decks",
        headers=auth_headers,
        json={"name": "To Delete", "is_public": False},
    )
    deck_id = created.json()["id"]

    deleted = client.delete(f"/decks/{deck_id}", headers=auth_headers)
    assert deleted.status_code == 204

    missing = client.get(f"/decks/{deck_id}", headers=auth_headers)
    assert missing.status_code == 404
