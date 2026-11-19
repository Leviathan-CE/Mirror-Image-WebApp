"""Stripe subscription helpers and entitlement rules."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from typing import Any

from app.roles import is_staff_role
from app.stripe_offers import (
    Offer,
    offer_for_price_id,
    primary_subscription_offer,
    resolve_price_id,
    resolve_subscription_offer,
    subscription_type_label,
)


# Statuses that unlock paid features for normal users.
ENTITLED_STATUSES = frozenset({"active", "trialing"})


def stripe_secret_key() -> str:
    return (os.environ.get("STRIPE_SECRET_KEY") or "").strip()


def stripe_publishable_key() -> str:
    return (os.environ.get("STRIPE_PUBLISHABLE_KEY") or "").strip()


def stripe_webhook_secret() -> str:
    return (os.environ.get("STRIPE_WEBHOOK_SECRET") or "").strip()


def stripe_price_id() -> str:
    """Primary subscription Stripe Price id (from offer catalog → env)."""
    return resolve_price_id(primary_subscription_offer())


def default_subscription_type() -> str:
    """Fallback tier label from ``stripe_offers`` catalog."""
    return subscription_type_label()


def _primary_offer():
    return primary_subscription_offer()


# Marketing copy for the Subscribe page (sourced from the catalog).
PLAN_DISPLAY_NAME = _primary_offer().label
PLAN_TAGLINE = _primary_offer().tagline
PLAN_FEATURES = _primary_offer().features


def require_stripe_config() -> tuple[str, str]:
    """Return (secret_key, primary price_id) or raise if billing is not configured."""
    key = stripe_secret_key()
    price = stripe_price_id()
    if not key or not price:
        raise ValueError("stripe_not_configured")
    return key, price


def require_offer_stripe_config(
    offer_id: str | None = None,
) -> tuple[str, str, Offer]:
    """
    Return (secret_key, price_id, offer) for a subscription offer.

    Defaults to the primary (Level 3) offer when ``offer_id`` is empty.
    """
    key = stripe_secret_key()
    if not key:
        raise ValueError("stripe_not_configured")
    try:
        offer = resolve_subscription_offer(offer_id)
    except KeyError as exc:
        raise ValueError(str(exc)) from exc
    price = resolve_price_id(offer)
    if not price:
        raise ValueError("stripe_price_missing_for_offer")
    return key, price, offer


def is_subscription_entitled(
    *,
    role: str,
    subscription_status: str,
) -> bool:
    """Staff (admin/developer) always pass; subscribers need an entitled Stripe status."""
    if is_staff_role(role):
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


def stripe_resource_id(value: Any) -> str | None:
    """Normalize a Stripe id that may be a string or an expanded object."""
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned or None
    data = _as_dict(value)
    raw = data.get("id")
    if raw is None:
        return None
    cleaned = str(raw).strip()
    return cleaned or None


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
    4. catalog ``subscription_type_label`` for the primary sub offer
    """
    data = _as_dict(sub)
    items = _as_dict(data.get("items")).get("data") or []
    if not items and hasattr(sub, "items"):
        items_obj = getattr(sub, "items", None)
        items = _as_dict(items_obj).get("data") or []

    for item in items:
        item_data = _as_dict(item)
        raw_price = item_data.get("price")
        # List/retrieve without expand leaves price as an id string.
        if isinstance(raw_price, str):
            price_id = raw_price.strip()
            matched = offer_for_price_id(price_id)
            if matched is not None:
                return subscription_type_label(matched)
            continue

        price = _as_dict(raw_price)
        meta = _as_dict(price.get("metadata"))
        for key in ("type", "tier", "subscription_type"):
            label = str(meta.get(key) or "").strip()
            if label:
                return label
        nickname = str(price.get("nickname") or "").strip()
        if nickname:
            return nickname
        price_id = str(price.get("id") or "").strip()
        matched = offer_for_price_id(price_id)
        if matched is not None:
            return subscription_type_label(matched)
        product = price.get("product")
        if isinstance(product, str) and product.strip():
            pass
        else:
            product_data = _as_dict(product)
            name = str(product_data.get("name") or "").strip()
            if name:
                return name

    return default_subscription_type()
