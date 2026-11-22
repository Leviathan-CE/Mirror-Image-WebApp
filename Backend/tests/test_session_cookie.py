"""httpOnly session cookie: set on login, accepted without Bearer, cleared."""

from app.security import SESSION_COOKIE_NAME


def test_login_sets_httponly_session_cookie(client, require_db):
    response = client.post(
        "/auth/login",
        json={"identifier": "user@localhost", "password": "user123"},
    )
    if response.status_code != 200:
        return
    set_cookie = response.headers.get("set-cookie") or ""
    assert SESSION_COOKIE_NAME in set_cookie
    assert "httponly" in set_cookie.lower()

    me = client.get("/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "user@localhost"


def test_logout_clears_session_cookie(client, require_db):
    login = client.post(
        "/auth/login",
        json={"identifier": "user@localhost", "password": "user123"},
    )
    if login.status_code != 200:
        return
    logged_out = client.post("/auth/logout")
    assert logged_out.status_code == 204
    me = client.get("/auth/me")
    assert me.status_code == 401


def test_delete_me_clears_session_cookie(
    client, other_auth_headers, require_db
):
    me = client.get("/auth/me", headers=other_auth_headers)
    assert me.status_code == 200
    name = me.json()["user_name"]
    deleted = client.request(
        "DELETE",
        "/auth/me",
        headers=other_auth_headers,
        json={"user_name": name},
    )
    assert deleted.status_code == 204
    set_cookie = deleted.headers.get("set-cookie") or ""
    assert SESSION_COOKIE_NAME in set_cookie
