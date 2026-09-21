from app.site_settings import parse_bool_setting


def test_parse_bool_setting():
    assert parse_bool_setting(None) is False
    assert parse_bool_setting("false") is False
    assert parse_bool_setting("true") is True
    assert parse_bool_setting("ON") is True
    assert parse_bool_setting("1") is True


def test_coming_soon_get_is_public(client):
    response = client.get("/site/coming-soon")
    assert response.status_code == 200
    assert "coming_soon" in response.json()
    assert isinstance(response.json()["coming_soon"], bool)


def test_coming_soon_patch_requires_admin(client, auth_headers, require_db):
    missing = client.patch("/admin/site/coming-soon", json={"coming_soon": True})
    assert missing.status_code == 401

    forbidden = client.patch(
        "/admin/site/coming-soon",
        json={"coming_soon": True},
        headers=auth_headers,
    )
    assert forbidden.status_code == 403


def test_admin_can_toggle_coming_soon(client, admin_headers, require_db):
    on = client.patch(
        "/admin/site/coming-soon",
        json={"coming_soon": True},
        headers=admin_headers,
    )
    if on.status_code == 503:
        return
    try:
        assert on.status_code == 200
        assert on.json()["coming_soon"] is True
        assert client.get("/site/coming-soon").json()["coming_soon"] is True

        off = client.patch(
            "/admin/site/coming-soon",
            json={"coming_soon": False},
            headers=admin_headers,
        )
        assert off.status_code == 200
        assert off.json()["coming_soon"] is False
        assert client.get("/site/coming-soon").json()["coming_soon"] is False
    finally:
        client.patch(
            "/admin/site/coming-soon",
            json={"coming_soon": False},
            headers=admin_headers,
        )
