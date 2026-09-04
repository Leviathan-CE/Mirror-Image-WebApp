from app.deck_defaults import DEFAULT_DECK_CATEGORY_NAMES
from app.user_preferences import (
    merge_preference_patch,
    normalize_user_preferences,
    preferences_are_unset,
)


def test_normalize_drops_unknown_and_clamps():
    out = normalize_user_preferences(
        {
            "deck_view": "list",
            "deck_sort": "nope",
            "deck_browse_width_px": 50,
            "library_page_size": 99,
            "library_preview_px": 900,
            "extra": True,
        }
    )
    assert out["deck_view"] == "list"
    assert out["deck_sort"] == "type"
    assert out["deck_browse_width_px"] == 280
    assert out["library_page_size"] == 50
    assert out["library_preview_px"] == 200
    assert "extra" not in out


def test_merge_partial_patch():
    current = normalize_user_preferences({"deck_view": "list"})
    merged = merge_preference_patch(current, {"deck_sort": "name"})
    assert merged["deck_view"] == "list"
    assert merged["deck_sort"] == "name"


def test_preferences_are_unset():
    assert preferences_are_unset({}) is True
    assert preferences_are_unset(None) is True
    assert preferences_are_unset({"deck_view": "list"}) is False


def test_patch_preferences_requires_auth(client):
    response = client.patch("/auth/me/preferences", json={"deck_view": "list"})
    assert response.status_code == 401


def test_patch_preferences_clamps_and_merges(client, auth_headers, require_db):
    response = client.patch(
        "/auth/me/preferences",
        headers=auth_headers,
        json={"deck_view": "list", "deck_browse_width_px": 12},
    )
    if response.status_code == 503:
        return
    assert response.status_code == 200
    body = response.json()
    assert body["deck_view"] == "list"
    assert body["deck_browse_width_px"] == 280

    me = client.get("/auth/me", headers=auth_headers)
    assert me.status_code == 200
    assert me.json()["preferences"]["deck_view"] == "list"


def test_normalize_start_sections_rules():
    out = normalize_user_preferences(
        {
            "deck_start_sections": [
                "  Main  ",
                "Main",
                "Pilot",
                "",
                "Side",
            ]
        }
    )
    assert out["deck_start_sections"] == ["Main", "Side"]


def test_create_deck_uses_start_section_prefs(
    client, auth_headers, require_db
):
    try:
        patched = client.patch(
            "/auth/me/preferences",
            headers=auth_headers,
            json={"deck_start_sections": ["Core", "Tech", "Spells"]},
        )
        if patched.status_code == 503:
            return
        assert patched.status_code == 200
        assert patched.json()["deck_start_sections"] == ["Core", "Tech", "Spells"]

        created = client.post(
            "/decks",
            headers=auth_headers,
            json={"name": "Pref Sections Deck", "is_public": False},
        )
        assert created.status_code == 201
        deck_id = created.json()["id"]
        cats = client.get(f"/decks/{deck_id}/categories", headers=auth_headers)
        assert cats.status_code == 200
        assert [c["name"] for c in cats.json()] == ["Core", "Tech", "Spells"]
        client.delete(f"/decks/{deck_id}", headers=auth_headers)
    finally:
        # Shared seed user — restore so other deck tests stay deterministic.
        client.patch(
            "/auth/me/preferences",
            headers=auth_headers,
            json={"deck_start_sections": list(DEFAULT_DECK_CATEGORY_NAMES)},
        )


def test_create_deck_accepts_start_sections_body(
    client, auth_headers, require_db
):
    created = client.post(
        "/decks",
        headers=auth_headers,
        json={
            "name": "Client Sections Deck",
            "is_public": False,
            "start_sections": ["Alpha", "Beta", "Gamma"],
        },
    )
    if created.status_code == 503:
        return
    assert created.status_code == 201
    deck_id = created.json()["id"]
    cats = client.get(f"/decks/{deck_id}/categories", headers=auth_headers)
    assert cats.status_code == 200
    assert [c["name"] for c in cats.json()] == ["Alpha", "Beta", "Gamma"]
    client.delete(f"/decks/{deck_id}", headers=auth_headers)
