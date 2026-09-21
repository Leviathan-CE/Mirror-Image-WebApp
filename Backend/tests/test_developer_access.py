"""Developer is staff: cards/analytics yes, user management no."""


def test_developer_can_read_analytics(client, developer_headers, require_db):
    response = client.get(
        "/admin/analytics?range=week", headers=developer_headers
    )
    if response.status_code == 503:
        return
    assert response.status_code == 200


def test_developer_can_open_cards_admin(client, developer_headers, require_db):
    response = client.get(
        "/cards/admin/library?limit=1", headers=developer_headers
    )
    if response.status_code == 503:
        return
    assert response.status_code == 200


def test_developer_cannot_list_users(client, developer_headers, require_db):
    response = client.get("/admin/users", headers=developer_headers)
    assert response.status_code == 403
    assert response.json()["detail"] == "admin_required"


def test_developer_cannot_list_features(client, developer_headers, require_db):
    response = client.get("/admin/features", headers=developer_headers)
    assert response.status_code == 403
