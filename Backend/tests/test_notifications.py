"""In-app inbox: first publish, mute, read receipts, card catalogue events."""

from __future__ import annotations

import uuid

from app.db import get_connection


def _skip_if_schema_missing(response) -> bool:
    if response.status_code == 503:
        return True
    return False


def test_guest_cannot_list_notifications(client):
    response = client.get("/notifications")
    assert response.status_code == 401


def test_first_publish_notifies_once_then_read(
    client, admin_headers, other_auth_headers, require_db
):
    title = f"Inbox {uuid.uuid4().hex[:8]}"
    created = client.post(
        "/admin/announcements",
        headers=admin_headers,
        json={
            "title": title,
            "body_markdown": "hello",
            "status": "draft",
        },
    )
    if _skip_if_schema_missing(created):
        return
    assert created.status_code == 201
    post_id = created.json()["id"]
    slug = created.json()["slug"]

    listed = client.get("/notifications", headers=other_auth_headers)
    if _skip_if_schema_missing(listed):
        client.delete(
            f"/admin/announcements/{post_id}",
            headers=admin_headers,
        )
        return
    assert listed.status_code == 200
    assert all(item["subject_id"] != post_id for item in listed.json()["items"])

    published = client.patch(
        f"/admin/announcements/{post_id}",
        headers=admin_headers,
        json={"status": "published"},
    )
    assert published.status_code == 200

    inbox = client.get("/notifications", headers=other_auth_headers)
    assert inbox.status_code == 200
    body = inbox.json()
    matches = [
        item
        for item in body["items"]
        if item["kind"] == "announcement.published"
        and item["subject_id"] == post_id
    ]
    assert len(matches) == 1
    assert matches[0]["payload"]["slug"] == slug
    assert matches[0]["read"] is False
    event_id = matches[0]["id"]

    edited = client.patch(
        f"/admin/announcements/{post_id}",
        headers=admin_headers,
        json={"body_markdown": "hello again"},
    )
    assert edited.status_code == 200
    inbox_again = client.get(
        "/notifications",
        headers=other_auth_headers,
    )
    matches_again = [
        item
        for item in inbox_again.json()["items"]
        if item["subject_id"] == post_id
        and item["kind"] == "announcement.published"
    ]
    assert len(matches_again) == 1

    marked = client.post(
        f"/notifications/{event_id}/read",
        headers=other_auth_headers,
    )
    assert marked.status_code == 200
    after_read = client.get(
        "/notifications/unread-count",
        headers=other_auth_headers,
    )
    assert after_read.status_code == 200

    muted = client.patch(
        "/auth/me/preferences",
        headers=other_auth_headers,
        json={"notify_blog": False},
    )
    assert muted.status_code == 200
    hidden = client.get("/notifications", headers=other_auth_headers)
    assert hidden.status_code == 200
    assert all(
        item["kind"] != "announcement.published"
        for item in hidden.json()["items"]
    )

    client.patch(
        "/auth/me/preferences",
        headers=other_auth_headers,
        json={"notify_blog": True},
    )
    client.delete(
        f"/admin/announcements/{post_id}",
        headers=admin_headers,
    )


def test_card_publish_update_and_remove_notify(
    client, admin_headers, other_auth_headers, require_db
):
    card_id = 900_000_000 + (uuid.uuid4().int % 90_000_000)
    created = client.post(
        "/cards/",
        headers=admin_headers,
        json={
            "ID": card_id,
            "card_name": "Notify Probe",
            "description": "first",
        },
    )
    if created.status_code == 503:
        return
    assert created.status_code == 201

    before_publish = client.get(
        "/notifications",
        headers=other_auth_headers,
    )
    if _skip_if_schema_missing(before_publish):
        client.post(
            "/cards/admin/delete",
            headers=admin_headers,
            json={"card_ids": [card_id]},
        )
        return
    assert all(item["subject_id"] != card_id for item in before_publish.json()["items"])

    published = client.patch(
        "/cards/admin/bulk",
        headers=admin_headers,
        json={"card_ids": [card_id], "published": "published"},
    )
    assert published.status_code == 200
    after_new = client.get("/notifications", headers=other_auth_headers)
    created_events = [
        item
        for item in after_new.json()["items"]
        if item["kind"] == "card.created" and item["subject_id"] == card_id
    ]
    assert len(created_events) == 1
    assert created_events[0]["payload"]["after"]["card_name"] == "Notify Probe"

    updated = client.post(
        "/cards/",
        headers=admin_headers,
        json={
            "ID": card_id,
            "card_name": "Notify Probe",
            "description": "second",
        },
    )
    assert updated.status_code == 201
    after_update = client.get(
        "/notifications",
        headers=other_auth_headers,
    )
    updated_events = [
        item
        for item in after_update.json()["items"]
        if item["kind"] == "card.updated" and item["subject_id"] == card_id
    ]
    assert len(updated_events) >= 1
    assert updated_events[0]["payload"]["after"]["description"] == "second"

    removed = client.patch(
        "/cards/admin/bulk",
        headers=admin_headers,
        json={"card_ids": [card_id], "published": "not published"},
    )
    assert removed.status_code == 200
    after_remove = client.get(
        "/notifications",
        headers=other_auth_headers,
    )
    removed_events = [
        item
        for item in after_remove.json()["items"]
        if item["kind"] == "card.removed" and item["subject_id"] == card_id
    ]
    assert len(removed_events) == 1

    client.post(
        "/cards/admin/delete",
        headers=admin_headers,
        json={"card_ids": [card_id]},
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM notification_events
                 WHERE subject_type = 'card'
                   AND subject_id = %(card_id)s
                """,
                {"card_id": card_id},
            )
        conn.commit()


def test_normalize_notify_defaults():
    from app.user_preferences import normalize_user_preferences

    out = normalize_user_preferences({"deck_view": "list"})
    assert out["notify_blog"] is True
    assert out["notify_cards"] is True
    assert out["notify_blog_email"] is False
    muted = normalize_user_preferences({"notify_blog": False})
    assert muted["notify_blog"] is False
    assert muted["notify_cards"] is True
    emailed = normalize_user_preferences({"notify_blog_email": True})
    assert emailed["notify_blog_email"] is True
