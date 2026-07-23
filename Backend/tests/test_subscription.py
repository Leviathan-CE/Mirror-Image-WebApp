"""Unit tests for Stripe subscription helpers (no live Stripe / DB)."""

from datetime import UTC, datetime

from app.subscription import (
    _as_dict,
    cancel_at_period_end_from_subscription,
    is_subscription_entitled,
    period_end_from_subscription,
    subscription_type_from_subscription,
)


class FakeStripeObject:
    """Mimics stripe.StripeObject: attribute access works, .get() does not."""

    def __init__(self, data: dict):
        self._data = data

    def to_dict(self):
        return dict(self._data)

    def __getattr__(self, name: str):
        try:
            return self._data[name]
        except KeyError as exc:
            raise AttributeError(name) from exc


def test_as_dict_handles_stripe_object_without_get():
    obj = FakeStripeObject({"customer": "cus_123", "status": "active"})
    # Real StripeObjects raise AttributeError on .get — we must not call it raw.
    try:
        obj.get("customer")
        raised = False
    except AttributeError:
        raised = True
    assert raised

    data = _as_dict(obj)
    assert data["customer"] == "cus_123"
    assert data["status"] == "active"


def test_is_subscription_entitled_rules():
    assert is_subscription_entitled(role="admin", subscription_status="none")
    assert is_subscription_entitled(role="user", subscription_status="active")
    assert is_subscription_entitled(role="user", subscription_status="trialing")
    assert not is_subscription_entitled(role="user", subscription_status="canceled")
    assert not is_subscription_entitled(role="user", subscription_status="none")
    assert not is_subscription_entitled(role="user", subscription_status="past_due")


def test_period_end_from_subscription_root_field():
    ts = 1_787_522_683
    end = period_end_from_subscription({"current_period_end": ts})
    assert end == datetime.fromtimestamp(ts, tz=UTC)


def test_period_end_from_subscription_item_field():
    """Newer Stripe API puts period bounds on subscription items."""
    ts = 1_787_522_683
    end = period_end_from_subscription(
        {
            "items": {
                "data": [
                    {"current_period_end": ts, "current_period_start": ts - 1000}
                ]
            }
        }
    )
    assert end == datetime.fromtimestamp(ts, tz=UTC)


def test_period_end_from_stripe_object_items():
    ts = 1_787_522_683
    sub = FakeStripeObject(
        {
            "items": {
                "data": [{"current_period_end": ts}],
            }
        }
    )
    assert period_end_from_subscription(sub) == datetime.fromtimestamp(ts, tz=UTC)


def test_cancel_classic_flag():
    assert cancel_at_period_end_from_subscription(
        {"status": "active", "cancel_at_period_end": True}
    )


def test_cancel_via_cancel_at_timestamp():
    """Portal cancel often sets cancel_at while cancel_at_period_end stays false."""
    assert cancel_at_period_end_from_subscription(
        {
            "status": "active",
            "cancel_at_period_end": False,
            "cancel_at": 1_787_522_683,
            "canceled_at": 1_784_845_265,
        }
    )


def test_cancel_via_cancellation_details_reason():
    assert cancel_at_period_end_from_subscription(
        {
            "status": "active",
            "cancel_at_period_end": False,
            "ended_at": None,
            "cancellation_details": {"reason": "cancellation_requested"},
        }
    )


def test_active_renewing_is_not_canceling():
    assert not cancel_at_period_end_from_subscription(
        {
            "status": "active",
            "cancel_at_period_end": False,
            "cancel_at": None,
            "ended_at": None,
            "cancellation_details": {"reason": None},
        }
    )


def test_subscription_type_from_price_metadata():
    label = subscription_type_from_subscription(
        {
            "items": {
                "data": [
                    {
                        "price": {
                            "metadata": {"type": "standard supporter"},
                            "nickname": "ignored",
                        }
                    }
                ]
            }
        }
    )
    assert label == "standard supporter"
