"""Blog mailing list: subscribe, unsubscribe, publish fan-out."""

from __future__ import annotations

import uuid

import pytest

from app.db import get_connection
from app.mailing_list import (
    blog_email_unsub_token,
    collect_blog_email_recipients,
    fanout_blog_post_emails,
    list_unsub_token,
    markdown_body_to_email_html,
    send_blog_post_email,
    subscribe_email,
    unsubscribe_by_token,
)
from app.site_settings import write_coming_soon
from app.user_preferences import normalize_user_preferences


@pytest.fixture
def require_blog_subscribers(require_db: None) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT to_regclass('public.blog_subscribers')
                """
            )
            if cur.fetchone()[0] is None:
                pytest.skip(
                    "blog_subscribers missing — run migration 39"
                )


@pytest.fixture
def sent_mail(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    captured: list[dict] = []

    def _fake_send(**kwargs):
        captured.append(kwargs)

    monkeypatch.setattr(
        "app.mailing_list.send_email",
        _fake_send,
    )
    return captured


def test_normalize_notify_blog_email_default():
    out = normalize_user_preferences({"deck_view": "list"})
    assert out["notify_blog_email"] is False
    on = normalize_user_preferences({"notify_blog_email": True})
    assert on["notify_blog_email"] is True


def test_markdown_body_to_email_html():
    html = markdown_body_to_email_html(
        "Hello **world**\n\n"
        "![art](media:1)\n\n"
        "See [site](https://example.com)"
    )
    assert "<strong>world</strong>" in html
    assert "media:1" not in html
    assert "art" in html
    assert 'href="https://example.com"' in html
    assert "<script>" not in markdown_body_to_email_html(
        '<script>alert(1)</script>'
    )
    assert "&lt;script&gt;" in markdown_body_to_email_html(
        '<script>alert(1)</script>'
    )


def test_markdown_body_embeds_cid_images():
    html = markdown_body_to_email_html(
        "Intro\n\n![Hero](media:9)\n\nOutro",
        {"media:9": "post-img-0@mirrorimage"},
    )
    assert 'src="cid:post-img-0@mirrorimage"' in html
    assert 'alt="Hero"' in html
    assert "media:9" not in html


def test_send_embeds_post_cid_parts(sent_mail):
    png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02"
        b"\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx"
        b"\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    send_blog_post_email(
        to="a@example.com",
        title="T",
        slug="t",
        body_markdown="![x](media:1)",
        unsubscribe_url="https://example.com/unsub?token=x",
        include_post_link=False,
        token_to_cid={"media:1": "post-img-0@mirrorimage"},
        post_inline_images=[
            ("post-img-0@mirrorimage", png, "png"),
        ],
    )
    assert len(sent_mail) == 1
    assert 'src="cid:post-img-0@mirrorimage"' in sent_mail[0][
        "html_body"
    ]
    inlines = sent_mail[0].get("inline_images") or []
    cids = {item[0] for item in inlines}
    assert "post-img-0@mirrorimage" in cids


def test_post_email_omits_link_when_flag_off(sent_mail):
    send_blog_post_email(
        to="a@example.com",
        title="T",
        slug="t",
        body_markdown="Body here.",
        unsubscribe_url="https://example.com/unsubscribe?token=x",
        include_post_link=False,
    )
    assert len(sent_mail) == 1
    assert "Read the post" not in sent_mail[0]["text_body"]
    assert "Read the post" not in sent_mail[0]["html_body"]
    assert "Body here." in sent_mail[0]["text_body"]
    assert "/updates?slug=" not in sent_mail[0]["text_body"]


def test_subscribe_sends_thank_you_once(
    client,
    require_blog_subscribers,
    sent_mail,
):
    email = f"list_{uuid.uuid4().hex[:10]}@example.com"
    first = client.post(
        "/mailing-list/subscribe",
        json={"email": email},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["subscribed"] is True
    assert body["already_subscribed"] is False
    assert len(sent_mail) == 1
    assert sent_mail[0]["to"] == email.lower()

    second = client.post(
        "/mailing-list/subscribe",
        json={"email": email},
    )
    assert second.status_code == 200
    assert second.json()["already_subscribed"] is True
    assert len(sent_mail) == 1

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM blog_subscribers
                 WHERE email = %(email)s
                """,
                {"email": email.lower()},
            )
        conn.commit()


def test_jwt_list_unsub_when_row_missing(
    require_blog_subscribers,
    require_db,
):
    email = f"ghost_{uuid.uuid4().hex[:10]}@example.com"
    token = list_unsub_token(email)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM blog_subscribers
                 WHERE email = %(email)s
                """,
                {"email": email.lower()},
            )
            kind = unsubscribe_by_token(cur, token)
            assert kind == "list"
            cur.execute(
                """
                SELECT status
                  FROM blog_subscribers
                 WHERE email = %(email)s
                """,
                {"email": email.lower()},
            )
            row = cur.fetchone()
            assert row is None
        conn.commit()


def test_unsubscribe_by_raw_token(
    require_blog_subscribers,
    require_db,
):
    email = f"unsub_{uuid.uuid4().hex[:10]}@example.com"
    with get_connection() as conn:
        with conn.cursor() as cur:
            result = subscribe_email(cur, email)
            raw = result["raw_token"]
            assert raw
            kind = unsubscribe_by_token(cur, raw)
            assert kind == "list"
            cur.execute(
                """
                SELECT status
                  FROM blog_subscribers
                 WHERE email = %(email)s
                """,
                {"email": email.lower()},
            )
            row = cur.fetchone()
            assert row is None
        conn.commit()


def test_unsubscribe_account_token_via_api(
    client,
    other_auth_headers,
    require_blog_subscribers,
    require_db,
):
    me = client.get("/auth/me", headers=other_auth_headers)
    assert me.status_code == 200
    user_id = int(me.json()["id"])
    client.patch(
        "/auth/me/preferences",
        headers=other_auth_headers,
        json={"notify_blog_email": True},
    )
    token = blog_email_unsub_token(user_id)
    response = client.get(
        "/mailing-list/unsubscribe",
        params={"token": token},
    )
    assert response.status_code == 200
    assert response.json()["kind"] == "account"
    me_after = client.get("/auth/me", headers=other_auth_headers)
    assert me_after.status_code == 200
    prefs = me_after.json().get("preferences") or {}
    assert prefs.get("notify_blog_email") is False


def test_fanout_respects_opt_in_and_checkbox(
    client,
    developer_headers,
    other_auth_headers,
    require_blog_subscribers,
    sent_mail,
    require_db,
):
    list_email = f"fan_{uuid.uuid4().hex[:10]}@example.com"
    with get_connection() as conn:
        with conn.cursor() as cur:
            subscribe_email(cur, list_email)
            write_coming_soon(cur, False)
        conn.commit()

    client.patch(
        "/auth/me/preferences",
        headers=other_auth_headers,
        json={"notify_blog_email": False},
    )

    title = f"Mail {uuid.uuid4().hex[:8]}"
    body_copy = "Full post body for email fans."
    created = client.post(
        "/admin/announcements",
        headers=developer_headers,
        json={
            "title": title,
            "body_markdown": body_copy,
            "status": "published",
            "email_subscribers": False,
        },
    )
    if created.status_code == 503:
        pytest.skip("announcements schema missing")
    assert created.status_code == 201
    post_id = created.json()["id"]
    assert created.json().get("emailed") is None
    assert len(sent_mail) == 0

    published = client.patch(
        f"/admin/announcements/{post_id}",
        headers=developer_headers,
        json={
            "status": "published",
            "email_subscribers": True,
        },
    )
    assert published.status_code == 200
    emailed = published.json().get("emailed")
    assert emailed is not None
    assert emailed >= 1
    targets = {item["to"] for item in sent_mail}
    assert list_email.lower() in targets
    assert any(
        body_copy in (item.get("text_body") or "")
        for item in sent_mail
    )
    assert any(
        body_copy in (item.get("html_body") or "")
        for item in sent_mail
    )
    assert any(
        "Read the post" in (item.get("html_body") or "")
        for item in sent_mail
    )

    me = client.get("/auth/me", headers=other_auth_headers)
    user_email = me.json()["email"].lower()
    assert user_email not in targets

    client.patch(
        "/auth/me/preferences",
        headers=other_auth_headers,
        json={"notify_blog_email": True},
    )
    sent_mail.clear()
    with get_connection() as conn:
        with conn.cursor() as cur:
            recipients = collect_blog_email_recipients(cur)
            emails = {row["email"] for row in recipients}
            assert list_email.lower() in emails
            assert user_email in emails
            stats = fanout_blog_post_emails(
                cur,
                title="again",
                slug="again",
                body_markdown="Second send body.",
            )
            assert stats["sent"] >= 2

    client.delete(
        f"/admin/announcements/{post_id}",
        headers=developer_headers,
    )
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM blog_subscribers
                 WHERE email = %(email)s
                """,
                {"email": list_email.lower()},
            )
        conn.commit()


def test_collect_skips_unsubscribed(
    require_blog_subscribers,
    require_db,
):
    email = f"skip_{uuid.uuid4().hex[:10]}@example.com"
    with get_connection() as conn:
        with conn.cursor() as cur:
            result = subscribe_email(cur, email)
            unsubscribe_by_token(cur, result["raw_token"])
            recipients = collect_blog_email_recipients(cur)
            emails = {row["email"] for row in recipients}
            assert email.lower() not in emails
            cur.execute(
                """
                DELETE FROM blog_subscribers
                 WHERE email = %(email)s
                """,
                {"email": email.lower()},
            )
        conn.commit()
