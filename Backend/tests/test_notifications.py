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


def _inbox_user(client) -> tuple[dict[str, str], str]:
    from app.security import hash_password

    suffix = uuid.uuid4().hex[:8]
    email = f"inboxdel_{suffix}@example.com"
    user_name = f"inboxdel_{suffix}"
    password = "testpass123"
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (
                    user_name, email, password, role, is_active,
                    email_verification_sent, email_verification_received,
                    email_verified_at
                )
                VALUES (
                    %(user_name)s, %(email)s, %(password)s, 'user',
                    TRUE, TRUE, TRUE, NOW()
                )
                """,
                {
                    "user_name": user_name,
                    "email": email,
                    "password": hash_password(password),
                },
            )
        conn.commit()
    login = client.post(
        "/auth/login",
        json={
            "identifier": email,
            "password": password,
            "client": "unity",
        },
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, email


def _delete_inbox_users(emails: list[str]) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM users
                 WHERE email = ANY(%(emails)s)
                """,
                {"emails": emails},
            )
        conn.commit()


def test_dismiss_hides_notice_for_that_user_only(
    client, require_db
):
    reader, reader_email = _inbox_user(client)
    other, other_email = _inbox_user(client)
    event_id = None
    try:
        subject_id = 800_000_000 + (uuid.uuid4().int % 90_000_000)
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO notification_events (
                        kind, subject_type, subject_id, title, summary
                    )
                    VALUES (
                        'announcement.published', 'announcement',
                        %(subject_id)s, 'Dismiss me',
                        'A notice to hide.'
                    )
                    RETURNING id
                    """,
                    {"subject_id": subject_id},
                )
                row = cur.fetchone()
            conn.commit()
        assert row is not None
        event_id = int(row[0])

        listed = client.get("/notifications", headers=reader)
        if _skip_if_schema_missing(listed):
            return
        assert listed.status_code == 200
        assert any(
            item["id"] == event_id
            for item in listed.json()["items"]
        )

        removed = client.delete(
            f"/notifications/{event_id}",
            headers=reader,
        )
        assert removed.status_code == 200
        assert removed.json()["dismissed"] == 1

        after = client.get("/notifications", headers=reader)
        assert after.status_code == 200
        assert all(
            item["id"] != event_id
            for item in after.json()["items"]
        )
        still = client.get("/notifications", headers=other)
        assert still.status_code == 200
        assert any(
            item["id"] == event_id
            for item in still.json()["items"]
        )
        again = client.delete(
            f"/notifications/{event_id}",
            headers=reader,
        )
        assert again.status_code == 404
    finally:
        if event_id is not None:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        DELETE FROM notification_events
                         WHERE id = %(event_id)s
                        """,
                        {"event_id": event_id},
                    )
                conn.commit()
        _delete_inbox_users([reader_email, other_email])


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


def _insert_notice(title: str) -> int:
    subject_id = 800_000_000 + (uuid.uuid4().int % 90_000_000)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO notification_events (
                    kind, subject_type, subject_id, title, summary
                )
                VALUES (
                    'announcement.published', 'announcement',
                    %(subject_id)s, %(title)s, 'Batch notice.'
                )
                RETURNING id
                """,
                {"subject_id": subject_id, "title": title},
            )
            row = cur.fetchone()
        conn.commit()
    assert row is not None
    return int(row[0])


def _delete_notice(event_id: int) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM notification_events
                 WHERE id = %(event_id)s
                """,
                {"event_id": event_id},
            )
        conn.commit()


def test_dismiss_selected_and_clear_all(client, require_db):
    reader, reader_email = _inbox_user(client)
    other, other_email = _inbox_user(client)
    first = _insert_notice("Batch one")
    second = _insert_notice("Batch two")
    third = _insert_notice("Batch three")
    try:
        picked = client.post(
            "/notifications/dismiss",
            headers=reader,
            json={"event_ids": [first, second]},
        )
        if _skip_if_schema_missing(picked):
            return
        assert picked.status_code == 200
        assert picked.json()["dismissed"] == 2

        left = client.get("/notifications", headers=reader)
        assert left.status_code == 200
        left_ids = [item["id"] for item in left.json()["items"]]
        assert first not in left_ids
        assert second not in left_ids
        assert third in left_ids

        cleared = client.post(
            "/notifications/dismiss-all",
            headers=reader,
        )
        assert cleared.status_code == 200
        assert cleared.json()["dismissed"] >= 1
        empty = client.get("/notifications", headers=reader)
        assert empty.status_code == 200
        empty_ids = [item["id"] for item in empty.json()["items"]]
        assert third not in empty_ids

        still = client.get("/notifications", headers=other)
        assert still.status_code == 200
        still_ids = [item["id"] for item in still.json()["items"]]
        assert first in still_ids
        assert third in still_ids
    finally:
        _delete_notice(first)
        _delete_notice(second)
        _delete_notice(third)
        _delete_inbox_users([reader_email, other_email])
