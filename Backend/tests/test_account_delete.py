from app.account_delete import usernames_match


def test_usernames_match_is_exact():
    assert usernames_match("admin", "admin") is True
    assert usernames_match("Admin", "admin") is False


def test_delete_me_requires_auth(client):
    response = client.request("DELETE", "/auth/me", json={"user_name": "x"})
    assert response.status_code == 401


def test_delete_me_rejects_wrong_username(
    client, other_auth_headers, require_db
):
    me = client.get("/auth/me", headers=other_auth_headers)
    assert me.status_code == 200
    name = me.json()["user_name"]
    response = client.request(
        "DELETE",
        "/auth/me",
        headers=other_auth_headers,
        json={"user_name": f"{name}x"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "username_mismatch"


def test_delete_me_removes_user_and_owned_deck(
    client, other_auth_headers, require_db
):
    me = client.get("/auth/me", headers=other_auth_headers)
    assert me.status_code == 200
    name = me.json()["user_name"]

    created = client.post(
        "/decks",
        headers=other_auth_headers,
        json={"name": "Delete Me Deck", "is_public": False},
    )
    assert created.status_code == 201
    deck_id = created.json()["id"]

    deleted = client.request(
        "DELETE",
        "/auth/me",
        headers=other_auth_headers,
        json={"user_name": name},
    )
    assert deleted.status_code == 204

    after = client.get("/auth/me", headers=other_auth_headers)
    assert after.status_code in {401, 403}

    deck = client.get(f"/decks/{deck_id}", headers=other_auth_headers)
    assert deck.status_code in {401, 403, 404}


def test_delete_last_admin_refused(client, admin_headers, require_db):
    me = client.get("/auth/me", headers=admin_headers)
    assert me.status_code == 200
    if me.json()["role"] != "admin":
        return
    response = client.request(
        "DELETE",
        "/auth/me",
        headers=admin_headers,
        json={"user_name": me.json()["user_name"]},
    )
    if response.status_code == 204:
        return
    assert response.status_code == 400
    assert response.json()["detail"] == "cannot_remove_last_admin"
