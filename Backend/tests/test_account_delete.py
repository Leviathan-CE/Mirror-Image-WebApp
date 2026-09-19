"""Account self-delete: username confirm, Stripe first, decks gone."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.account_delete import (
    AccountDeleteError,
    cancel_stripe_for_user,
    username_matches_for_delete,
)
from app.db import get_connection
from app.security import hash_password


def test_username_must_match_exactly():
    assert username_matches_for_delete("Hero", "Hero") is True
    assert username_matches_for_delete(" Hero ", "Hero") is True
    assert username_matches_for_delete("hero", "Hero") is False
    assert username_matches_for_delete("", "Hero") is False


def test_cancel_stripe_skips_when_no_ids(monkeypatch):
    monkeypatch.setattr("app.account_delete.stripe_secret_key", lambda: "")
    cancel_stripe_for_user(customer_id=None, subscription_id=None)


def test_cancel_stripe_refuses_without_api_key(monkeypatch):
    monkeypatch.setattr("app.account_delete.stripe_secret_key", lambda: "")
    with pytest.raises(AccountDeleteError) as exc:
        cancel_stripe_for_user(customer_id="cus_test", subscription_id=None)
    assert exc.value.detail == "stripe_cancel_failed"


def test_cancel_stripe_cancels_then_deletes_customer(monkeypatch):
    monkeypatch.setattr("app.account_delete.stripe_secret_key", lambda: "sk_test")
    listed = MagicMock()
    listed.data = [
        {"id": "sub_live", "status": "active"},
        {"id": "sub_old", "status": "canceled"},
    ]
    cancel = MagicMock()
    delete = MagicMock()
    monkeypatch.setattr(
        "app.account_delete.stripe.Subscription.list",
        lambda **_kwargs: listed,
    )
    monkeypatch.setattr("app.account_delete.stripe.Subscription.cancel", cancel)
    monkeypatch.setattr("app.account_delete.stripe.Customer.delete", delete)

    cancel_stripe_for_user(customer_id="cus_test", subscription_id="sub_unused")

    cancel.assert_called_once_with("sub_live")
    delete.assert_called_once_with("cus_test")


def _insert_user(user_name: str, email: str) -> int:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (
                    user_name, email, password, role, is_active,
                    email_verification_received, email_verified_at
                )
                VALUES (
                    %(user_name)s, %(email)s, %(password)s, 'user', TRUE,
                    TRUE, NOW()
                )
                RETURNING id
                """,
                {
                    "user_name": user_name,
                    "email": email,
                    "password": hash_password("testpass123"),
                },
            )
            user_id = int(cur.fetchone()[0])
        conn.commit()
    return user_id


def test_delete_account_requires_username_and_removes_decks(
    client, require_db
):
    suffix = uuid.uuid4().hex[:8]
    user_name = f"del_{suffix}"
    email = f"del_{suffix}@example.com"
    try:
        _insert_user(user_name, email)
    except Exception as exc:
        pytest.skip(f"could not insert user: {exc}")

    login = client.post(
        "/auth/login",
        json={"identifier": email, "password": "testpass123"},
    )
    if login.status_code != 200:
        pytest.skip(f"login failed: {login.text}")
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    created = client.post(
        "/decks",
        headers=headers,
        json={"name": f"gone-{suffix}", "is_public": True},
    )
    assert created.status_code == 201
    deck_id = created.json()["id"]

    wrong = client.request(
        "DELETE",
        "/auth/me",
        headers=headers,
        json={"user_name": "not-my-name"},
    )
    assert wrong.status_code == 400
    assert wrong.json()["detail"] == "username_mismatch"
    assert client.get(f"/decks/{deck_id}", headers=headers).status_code == 200

    gone = client.request(
        "DELETE",
        "/auth/me",
        headers=headers,
        json={"user_name": user_name},
    )
    assert gone.status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401
    assert client.get(f"/decks/{deck_id}").status_code == 404
