"""Announcement board: public vs staff, sanitize on write."""


def test_user_cannot_create(client, auth_headers, require_db):
    response = client.post(
        "/admin/announcements",
        headers=auth_headers,
        json={"title": "Nope", "body_markdown": "x"},
    )
    if response.status_code == 503:
        return
    assert response.status_code == 403


def test_staff_create_stays_draft(client, admin_headers, require_db):
    created = client.post(
        "/admin/announcements",
        headers=admin_headers,
        json={
            "title": "Secret draft",
            "body_markdown": "Hello <script>alert(1)</script> ![x](https://attacker.example/x)",
            "status": "draft",
        },
    )
    if created.status_code == 503:
        return
    assert created.status_code == 201
    body = created.json()
    assert body["status"] == "draft"
    assert "<script>" not in body["body_markdown"]
    assert "attacker" not in body["body_markdown"]

    public = client.get("/announcements")
    assert public.status_code == 200
    assert all(item["slug"] != body["slug"] for item in public.json())

    missing = client.get(f"/announcements/{body['slug']}")
    assert missing.status_code == 404

    published = client.patch(
        f"/admin/announcements/{body['id']}",
        headers=admin_headers,
        json={"status": "published"},
    )
    assert published.status_code == 200
    listed = client.get("/announcements")
    assert any(item["slug"] == body["slug"] for item in listed.json())

    client.delete(
        f"/admin/announcements/{body['id']}",
        headers=admin_headers,
    )


def test_developer_can_create(client, developer_headers, require_db):
    created = client.post(
        "/admin/announcements",
        headers=developer_headers,
        json={"title": "Dev post", "body_markdown": "ok", "status": "draft"},
    )
    if created.status_code == 503:
        return
    assert created.status_code == 201
    client.delete(
        f"/admin/announcements/{created.json()['id']}",
        headers=developer_headers,
    )
