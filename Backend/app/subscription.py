"""Stripe subscription helpers and entitlement rules."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any


# Statuses that unlock paid features for normal users.
ENTITLED_STATUSES = frozenset({"active", "trialing"})


def stripe_secret_key() -> str:
    return (os.environ.get("STRIPE_SECRET_KEY") or "").strip()


def stripe_webhook_secret() -> str:
    return (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()


def stripe_price_id() -> str:
    return (os.environ.get("STRIPE_PRICE_ID") or "").strip()


def default_subscription_type() -> str:
    """Fallback tier label when Stripe price has no nickname/metadata."""
    return (
        (os.environ.get("STRIPE_SUBSCRIPTION_TYPE") or "").strip()
        or "standard supporter"
    )


# Marketing copy for the Subscribe page (features may land later).
PLAN_DISPLAY_NAME = "Standard Supporter"
PLAN_TAGLINE = (
    "Support Mirror Image development and unlock early-access play spaces."
)
PLAN_FEATURES = (
    "Access preview cards still in design",
    "Play with friends in the Playtester",
)


def require_stripe_config() -> tuple[str, str]:
    """Return (secret_key, price_id) or raise ValueError if billing is not configured."""
    key = stripe_secret_key()
    price = stripe_price_id()
    if not key or not price:
        raise ValueError("stripe_not_configured")
    return key, price


def is_subscription_entitled(
    *,
    role: str,
    subscription_status: str,
) -> bool:
    """Admins always pass; subscribers need an entitled Stripe status."""
    if role == "admin":
        return True
    return subscription_status in ENTITLED_STATUSES


def _as_dict(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    to_dict = getattr(value, "to_dict", None)
    if callable(to_dict):
        try:
            return dict(to_dict())
        except Exception:
            pass
    try:
        return dict(value)
    except Exception:
        return {}


def period_end_from_subscription(sub: Any) -> datetime | None:
    """Parse current_period_end from a Stripe Subscription (or its items)."""
    data = _as_dict(sub)
    raw = data.get("current_period_end")
    if raw is None and not isinstance(sub, dict):
        raw = getattr(sub, "current_period_end", None)

    # Newer Stripe API shapes keep period bounds on subscription items.
    if raw is None:
        items = _as_dict(data.get("items")).get("data") or []
        if not items and hasattr(sub, "items"):
            items = _as_dict(getattr(sub, "items", None)).get("data") or []
        for item in items:
            item_data = _as_dict(item)
            raw = item_data.get("current_period_end")
            if raw is not None:
                break

    if raw is None:
        return None
    try:
        return datetime.fromtimestamp(int(raw), tz=UTC)
    except (TypeError, ValueError, OSError):
        return None



def cancel_at_period_end_from_subscription(sub: Any) -> bool:
    """True when Stripe will stop renewing (scheduled cancel / period end)."""
    data = _as_dict(sub)
    if bool(data.get("cancel_at_period_end")):
        return True

    # Newer Stripe API: cancel-at-period-end often sets `cancel_at` instead of
    # (or without) the classic `cancel_at_period_end` boolean.
    status = str(data.get("status") or "")
    if data.get("cancel_at") is not None and status in (
        "active",
        "trialing",
        "past_due",
    ):
        return True

    details = _as_dict(data.get("cancellation_details"))
    if (
        details.get("reason") == "cancellation_requested"
        and data.get("ended_at") is None
        and status in ("active", "trialing", "past_due")
    ):
        return True

    return False


def subscription_type_from_subscription(sub: Any) -> str:
    """
    Resolve a plain-text tier label from a Stripe Subscription.

    Preference order:
    1. price.metadata['type'] or ['tier']
    2. price.nickname
    3. product name (when expanded)
    4. STRIPE_SUBSCRIPTION_TYPE / default ``standard``
    """
    data = _as_dict(sub)
    items = _as_dict(data.get("items")).get("data") or []
    if not items and hasattr(sub, "items"):
        items_obj = getattr(sub, "items", None)
        items = _as_dict(items_obj).get("data") or []

    for item in items:
        item_data = _as_dict(item)
        price = _as_dict(item_data.get("price"))
        meta = _as_dict(price.get("metadata"))
        for key in ("type", "tier", "subscription_type"):
            label = str(meta.get(key) or "").strip()
            if label:
                return label
        nickname = str(price.get("nickname") or "").strip()
        if nickname:
            return nickname
        product = price.get("product")
        if isinstance(product, str) and product.strip():
            pass
        else:
            product_data = _as_dict(product)
            name = str(product_data.get("name") or "").strip()
            if name:
                return name

    return default_subscription_type()
