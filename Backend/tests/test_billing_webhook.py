"""Billing webhook + checkout regressions (mocked Stripe; no live network)."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routers import billing as billing_router
from tests.test_subscription import FakeStripeObject


@pytest.fixture
def stripe_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_unit")
    monkeypatch.setenv("STRIPE_PRICE_ID", "price_unit")
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", "whsec_unit")


@pytest.fixture
def capture_apply(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    """Replace DB writes with an in-memory capture list."""
    applied: list[dict[str, Any]] = []

    def _fake_apply(_cur, **kwargs: Any) -> None:
        applied.append(kwargs)

    monkeypatch.setattr(billing_router, "_apply_subscription_row", _fake_apply)
    monkeypatch.setattr(
        billing_router, "_apply_retrieved_subscription", lambda *a, **k: None
    )
    monkeypatch.setattr(
        billing_router, "_sync_customer_subscriptions", lambda *a, **k: 0
    )
    return applied


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch) -> MagicMock:
    cursor = MagicMock()
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    conn.cursor.return_value.__exit__.return_value = None

    @contextmanager
    def _conn():
        yield conn

    monkeypatch.setattr(billing_router, "get_connection", _conn)
    return cursor


def test_webhook_subscription_updated_accepts_stripe_object(
    client: TestClient,
    stripe_env: None,
    capture_apply: list[dict[str, Any]],
    fake_db: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
):
    """Regression: StripeObject has no .get — must convert before reading fields."""
    sub = FakeStripeObject(
        {
            "id": "sub_test",
            "customer": "cus_test",
            "status": "active",
            "cancel_at_period_end": False,
            "cancel_at": 1_787_522_683,
            "items": {
                "data": [
                    {
                        "current_period_end": 1_787_522_683,
                        "price": {"metadata": {"type": "standard supporter"}},
                    }
                ]
            },
        }
    )
    event = {
        "type": "customer.subscription.updated",
        "data": {"object": sub},
    }

    monkeypatch.setattr(
        billing_router.stripe.Webhook,
        "construct_event",
        lambda *a, **k: event,
    )

    response = client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "t=1,v1=fake"},
    )
    assert response.status_code == 200, response.text
    assert len(capture_apply) == 1
    row = capture_apply[0]
    assert row["customer_id"] == "cus_test"
    assert row["subscription_id"] == "sub_test"
    assert row["subscription_status"] == "active"
    assert row["cancel_at_period_end"] is True
    assert row["subscription_type"] == "standard supporter"


def test_webhook_subscription_deleted_clears_cancel_flag(
    client: TestClient,
    stripe_env: None,
    capture_apply: list[dict[str, Any]],
    fake_db: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
):
    sub = FakeStripeObject(
        {
            "id": "sub_gone",
            "customer": "cus_test",
            "status": "canceled",
            "cancel_at_period_end": True,
        }
    )
    event = {
        "type": "customer.subscription.deleted",
        "data": {"object": sub},
    }
    monkeypatch.setattr(
        billing_router.stripe.Webhook,
        "construct_event",
        lambda *a, **k: event,
    )

    response = client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "t=1,v1=fake"},
    )
    assert response.status_code == 200
    assert capture_apply[0]["subscription_status"] == "canceled"
    assert capture_apply[0]["cancel_at_period_end"] is False
    assert capture_apply[0]["subscription_type"] == ""


def test_checkout_handles_eight_column_billing_row(
    client: TestClient,
    stripe_env: None,
    monkeypatch: pytest.MonkeyPatch,
):
    """Regression: adding cancel_at_period_end broke 7-tuple unpack in checkout."""

    def _fake_user_id() -> int:
        return 42

    monkeypatch.setattr(billing_router, "get_current_user_id", _fake_user_id)
    # Override FastAPI dependency
    from app.main import app
    from app.security import get_current_user_id

    app.dependency_overrides[get_current_user_id] = _fake_user_id

    # 8-column row matching _fetch_user_billing SELECT
    eight_col_row = (
        42,
        "pilot@example.com",
        "user",
        None,  # no customer yet
        "none",
        "",
        None,
        False,
    )

    cursor = MagicMock()
    cursor.fetchone.return_value = eight_col_row
    conn = MagicMock()
    conn.cursor.return_value.__enter__.return_value = cursor
    conn.cursor.return_value.__exit__.return_value = None

    @contextmanager
    def _conn():
        yield conn

    monkeypatch.setattr(billing_router, "get_connection", _conn)
    monkeypatch.setattr(
        billing_router,
        "_ensure_stripe_customer",
        lambda *a, **k: "cus_new",
    )

    class Session:
        url = "https://checkout.stripe.test/session"

    monkeypatch.setattr(
        billing_router.stripe.checkout.Session,
        "create",
        lambda **kwargs: Session(),
    )

    try:
        response = client.post(
            "/billing/checkout",
            json={"return_origin": "http://localhost:5173"},
            headers={"Authorization": "Bearer unused"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    assert response.json()["url"] == "https://checkout.stripe.test/session"
