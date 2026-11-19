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
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_3", "price_unit")
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
    monkeypatch.setattr(
        billing_router,
        "_cancel_incomplete_subscriptions",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        billing_router,
        "_find_changeable_subscription",
        lambda *a, **k: None,
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


def test_billing_config_exposes_publishable_never_secret(
    client: TestClient,
    stripe_env: None,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_public_only")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_test_must_not_leak")

    response = client.get("/billing/config")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["stripe_configured"] is True
    assert body["publishable_key"] == "pk_test_public_only"
    dumped = response.text
    assert "sk_test_must_not_leak" not in dumped
    assert "STRIPE_SECRET" not in dumped


def test_subscription_intent_changes_existing_plan(
    client: TestClient,
    stripe_env: None,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_unit")
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_3", "price_new_tier")

    def _fake_user_id() -> int:
        return 7

    from app.main import app
    from app.security import get_current_user_id

    app.dependency_overrides[get_current_user_id] = _fake_user_id

    entitled_row = (
        7,
        "fan@example.com",
        "user",
        "cus_existing",
        "active",
        "LEVEL 1 — ARCHIVIST",
        None,
        False,
    )
    cursor = MagicMock()
    cursor.fetchone.return_value = entitled_row
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
        lambda *a, **k: "cus_existing",
    )
    monkeypatch.setattr(
        billing_router,
        "_cancel_incomplete_subscriptions",
        lambda *a, **k: None,
    )
    existing = FakeStripeObject(
        {
            "id": "sub_old",
            "items": {
                "data": [
                    {
                        "id": "si_old",
                        "price": {"id": "price_old_tier"},
                    }
                ]
            },
        }
    )
    created = FakeStripeObject(
        {
            "id": "sub_new_change",
            "latest_invoice": {
                "confirmation_secret": {
                    "client_secret": "pi_change_secret",
                }
            },
        }
    )
    monkeypatch.setattr(
        billing_router,
        "_find_changeable_subscription",
        lambda *a, **k: existing,
    )
    create_kwargs: dict = {}

    def _fake_create(**kwargs):
        create_kwargs.update(kwargs)
        return created

    monkeypatch.setattr(
        billing_router,
        "_create_subscription_requiring_payment",
        _fake_create,
    )

    try:
        response = client.post(
            "/billing/subscription/intent",
            headers={"Authorization": "Bearer unused"},
            json={"offer_id": "level3_warmachine"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["client_secret"] == "pi_change_secret"
    assert body["payment_required"] is True
    assert body["subscription_id"] == "sub_new_change"
    assert create_kwargs.get("replacing_subscription_id") == "sub_old"


def test_subscription_intent_rejects_same_plan(
    client: TestClient,
    stripe_env: None,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_unit")
    monkeypatch.setenv("STRIPE_PRICE_ID_LVL_3", "price_same")

    def _fake_user_id() -> int:
        return 8

    from app.main import app
    from app.security import get_current_user_id

    app.dependency_overrides[get_current_user_id] = _fake_user_id

    entitled_row = (
        8,
        "same@example.com",
        "user",
        "cus_same",
        "active",
        "LEVEL 3 — WARMACHINE",
        None,
        False,
    )
    cursor = MagicMock()
    cursor.fetchone.return_value = entitled_row
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
        lambda *a, **k: "cus_same",
    )
    monkeypatch.setattr(
        billing_router,
        "_cancel_incomplete_subscriptions",
        lambda *a, **k: None,
    )
    existing = FakeStripeObject(
        {
            "id": "sub_same",
            "items": {
                "data": [
                    {"id": "si_1", "price": {"id": "price_same"}}
                ]
            },
        }
    )
    monkeypatch.setattr(
        billing_router,
        "_find_changeable_subscription",
        lambda *a, **k: existing,
    )

    try:
        response = client.post(
            "/billing/subscription/intent",
            headers={"Authorization": "Bearer unused"},
            json={"offer_id": "level3_warmachine"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["already_on_plan"] is True
    assert body["payment_required"] is False
    assert body["client_secret"] == ""
    assert body["subscription_id"] == "sub_same"


def test_subscription_intent_returns_client_secret(
    client: TestClient,
    stripe_env: None,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_unit")

    def _fake_user_id() -> int:
        return 9

    from app.main import app
    from app.security import get_current_user_id

    app.dependency_overrides[get_current_user_id] = _fake_user_id

    open_row = (
        9,
        "new@example.com",
        "user",
        "cus_open",
        "none",
        "",
        None,
        False,
    )
    cursor = MagicMock()
    cursor.fetchone.return_value = open_row
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
        lambda *a, **k: "cus_open",
    )
    monkeypatch.setattr(
        billing_router,
        "_cancel_incomplete_subscriptions",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        billing_router,
        "_find_changeable_subscription",
        lambda *a, **k: None,
    )

    fake_sub = FakeStripeObject(
        {
            "id": "sub_incomplete_1",
            "latest_invoice": {
                "confirmation_secret": {
                    "client_secret": "pi_sub_1_secret_abc",
                }
            },
        }
    )
    monkeypatch.setattr(
        billing_router.stripe.Subscription,
        "create",
        lambda **kwargs: fake_sub,
    )

    try:
        response = client.post(
            "/billing/subscription/intent",
            headers={"Authorization": "Bearer unused"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["client_secret"] == "pi_sub_1_secret_abc"
    assert body["subscription_id"] == "sub_incomplete_1"
    assert body["offer_id"] == "level3_warmachine"
    assert body["payment_required"] is True


def test_subscription_intent_falls_back_to_payment_intent_secret(
    client: TestClient,
    stripe_env: None,
    monkeypatch: pytest.MonkeyPatch,
):
    """Pre-Basil invoice shape still works via payment_intent."""
    monkeypatch.setenv("STRIPE_PUBLISHABLE_KEY", "pk_test_unit")

    def _fake_user_id() -> int:
        return 10

    from app.main import app
    from app.security import get_current_user_id

    app.dependency_overrides[get_current_user_id] = _fake_user_id

    open_row = (
        10,
        "legacy@example.com",
        "user",
        "cus_legacy",
        "none",
        "",
        None,
        False,
    )
    cursor = MagicMock()
    cursor.fetchone.return_value = open_row
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
        lambda *a, **k: "cus_legacy",
    )
    monkeypatch.setattr(
        billing_router,
        "_cancel_incomplete_subscriptions",
        lambda *a, **k: None,
    )
    monkeypatch.setattr(
        billing_router,
        "_find_changeable_subscription",
        lambda *a, **k: None,
    )
    fake_sub = FakeStripeObject(
        {
            "id": "sub_legacy_1",
            "latest_invoice": {
                "payment_intent": {
                    "id": "pi_legacy",
                    "client_secret": "pi_legacy_secret",
                }
            },
        }
    )
    monkeypatch.setattr(
        billing_router.stripe.Subscription,
        "create",
        lambda **kwargs: fake_sub,
    )

    try:
        response = client.post(
            "/billing/subscription/intent",
            headers={"Authorization": "Bearer unused"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200, response.text
    assert response.json()["client_secret"] == "pi_legacy_secret"


def test_webhook_element_path_activates_incomplete_subscription(
    client: TestClient,
    stripe_env: None,
    capture_apply: list[dict[str, Any]],
    fake_db: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
):
    """Payment Element confirm → subscription.updated incomplete→active."""
    sub = FakeStripeObject(
        {
            "id": "sub_was_incomplete",
            "customer": "cus_element",
            "status": "active",
            "cancel_at_period_end": False,
            "items": {
                "data": [
                    {
                        "current_period_end": 1_800_000_000,
                        "price": {
                            "metadata": {
                                "type": "LEVEL 3 ACCESS MEMBER TIER"
                            }
                        },
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
    assert row["subscription_id"] == "sub_was_incomplete"
    assert row["subscription_status"] == "active"
    assert row["customer_id"] == "cus_element"


def test_checkout_route_still_registered(client: TestClient):
    """Dual-path plan keeps redirect Checkout alongside Payment Element."""
    # OpenAPI paths stay stable when Starlette nests routes under mounts.
    paths = set(client.app.openapi()["paths"])
    assert "/billing/checkout" in paths
    assert "/billing/subscription/intent" in paths
    assert "/billing/config" in paths


def test_webhook_print_payment_intent_grants_download(
    client: TestClient,
    stripe_env: None,
    fake_db: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
):
    grants: list[dict[str, Any]] = []

    def _fake_upsert(_cur, **kwargs: Any) -> int:
        grants.append(kwargs)
        return 501

    monkeypatch.setattr(billing_router, "_upsert_print_grant", _fake_upsert)

    pi = FakeStripeObject(
        {
            "id": "pi_print_1",
            "amount": 199,
            "metadata": {
                "offer_id": "deck_print_download",
                "user_id": "11",
                "deck_id": "22",
                "card_count": "12",
                "amount_cents": "199",
            },
        }
    )
    event = {
        "type": "payment_intent.succeeded",
        "data": {"object": pi},
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
    assert len(grants) == 1
    assert grants[0]["user_id"] == 11
    assert grants[0]["deck_id"] == 22
    assert grants[0]["payment_intent_id"] == "pi_print_1"
    assert grants[0]["amount_cents"] == 199
