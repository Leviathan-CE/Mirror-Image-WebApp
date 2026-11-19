"""Stripe Checkout + Customer Portal + webhooks for feature unlocks."""

from __future__ import annotations

import logging
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from psycopg2 import OperationalError

from datetime import UTC, datetime, timedelta

from app.db import get_connection
from app.decks.access import require_readable_deck
from app.features import (
    FEATURE_DECK_PRINTOUT,
    load_granted_feature_keys,
    sync_subscription_entitlement_grants,
)
from app.roles import is_staff_role
from app.security import get_current_user_id
from app.settings import resolve_frontend_origin
from app.stripe_offers import (
    PRIMARY_SUBSCRIPTION_OFFER_ID,
    format_offer_price_display,
    offer_for_subscription_type_label,
    print_amount_cents,
    resolve_price_id,
    resolve_subscription_offer,
    subscription_offers,
    subscription_type_label as offer_type_label,
)
from app.subscription import (
    PLAN_DISPLAY_NAME,
    PLAN_FEATURES,
    PLAN_TAGLINE,
    default_subscription_type,
    is_subscription_entitled,
    cancel_at_period_end_from_subscription,
    _as_dict,
    period_end_from_subscription,
    require_offer_stripe_config,
    require_stripe_config,
    stripe_publishable_key,
    stripe_resource_id,
    subscription_type_from_subscription,
    stripe_secret_key,
    stripe_webhook_secret,
)

PRINT_GRANT_TTL = timedelta(hours=2)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutSessionRequest(BaseModel):
    """Optional browser origin so cancel/success match where the user is browsing."""

    return_origin: str | None = None
    offer_id: str | None = None


class SubscriptionIntentRequest(BaseModel):
    offer_id: str | None = None


class CheckoutSessionResponse(BaseModel):
    url: str


class PortalSessionRequest(BaseModel):
    return_origin: str | None = None


class PortalSessionResponse(BaseModel):
    url: str


class BillingStatusResponse(BaseModel):
    subscription_status: str
    subscription_type: str = ""
    subscription_current_period_end: str | None
    cancel_at_period_end: bool = False
    is_subscribed: bool
    stripe_configured: bool


class BillingPlanResponse(BaseModel):
    """Public plan card for the Subscribe page."""

    name: str
    type: str
    tagline: str
    features: list[str]
    price_display: str
    currency: str | None = None
    unit_amount: int | None = None
    interval: str | None = None
    stripe_configured: bool
    offer_id: str = PRIMARY_SUBSCRIPTION_OFFER_ID
    print_downloads_per_month: int | None = None
    price_configured: bool = False


class BillingPlansResponse(BaseModel):
    plans: list[BillingPlanResponse]
    stripe_configured: bool


class BillingConfigResponse(BaseModel):
    publishable_key: str
    stripe_configured: bool


class SubscriptionIntentResponse(BaseModel):
    client_secret: str = ""
    offer_id: str
    subscription_id: str
    payment_required: bool = True
    already_on_plan: bool = False


class PrintQuoteResponse(BaseModel):
    deck_id: int
    card_count: int
    amount_cents: int
    amount_display: str
    currency: str = "usd"
    entitled_free: bool


class PrintIntentRequest(BaseModel):
    deck_id: int


class PrintIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    deck_id: int
    card_count: int
    amount_cents: int
    amount_display: str


class PrintAccessResponse(BaseModel):
    allowed: bool
    entitled_free: bool
    grant_id: int | None = None


class PrintConfirmRequest(BaseModel):
    payment_intent_id: str


def _format_money(unit_amount: int, currency: str) -> str:
    """Stripe amounts are the smallest currency unit (e.g. cents)."""
    major = unit_amount / 100
    code = (currency or "usd").upper()
    if code == "USD":
        if major == int(major):
            return f"${int(major)}"
        return f"${major:.2f}"
    if major == int(major):
        return f"{int(major)} {code}"
    return f"{major:.2f} {code}"


def _db_unavailable(exc: OperationalError) -> HTTPException:
    logger.warning("db error on billing: %s", exc)
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="database_unavailable",
    )


def _fetch_user_billing(cur, user_id: int) -> tuple | None:
    cur.execute(
        """
        SELECT id, email, role, stripe_customer_id, subscription_status,
               subscription_type, subscription_current_period_end,
               subscription_cancel_at_period_end
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    return cur.fetchone()


def _ensure_stripe_customer(
    cur,
    *,
    user_id: int,
    email: str,
    existing_customer_id: str | None,
) -> str:
    if existing_customer_id:
        return existing_customer_id

    customer = stripe.Customer.create(
        email=email,
        metadata={"user_id": str(user_id)},
    )
    customer_id = customer["id"]
    cur.execute(
        """
        UPDATE users
           SET stripe_customer_id = %(customer_id)s,
               updated_at = NOW()
         WHERE id = %(user_id)s
        """,
        {"customer_id": customer_id, "user_id": user_id},
    )
    return customer_id


def _apply_subscription_row(
    cur,
    *,
    user_id: int | None = None,
    customer_id: str | None = None,
    subscription_id: str | None,
    subscription_status: str,
    subscription_type: str = "",
    period_end: Any = None,
    cancel_at_period_end: bool = False,
) -> None:
    if user_id is None and customer_id is None:
        return

    where = (
        "id = %(user_id)s"
        if user_id is not None
        else "stripe_customer_id = %(customer_id)s"
    )
    status_value = subscription_status or "none"
    type_value = (subscription_type or "").strip()
    cur.execute(
        f"""
        UPDATE users
           SET stripe_subscription_id = %(subscription_id)s,
               subscription_status = %(subscription_status)s,
               subscription_type = %(subscription_type)s,
               subscription_current_period_end = %(period_end)s,
               subscription_cancel_at_period_end = %(cancel_at_period_end)s,
               updated_at = NOW()
         WHERE {where}
        """,
        {
            "user_id": user_id,
            "customer_id": customer_id,
            "subscription_id": subscription_id,
            "subscription_status": status_value,
            "subscription_type": type_value,
            "period_end": period_end,
            "cancel_at_period_end": bool(cancel_at_period_end),
        },
    )

    # Keep feature grants aligned with the tier (duplex on L2/L3, etc.).
    resolved_id = user_id
    if resolved_id is None and customer_id:
        cur.execute(
            """
            SELECT id
              FROM users
             WHERE stripe_customer_id = %(customer_id)s
             LIMIT 1
            """,
            {"customer_id": customer_id},
        )
        found = cur.fetchone()
        resolved_id = int(found[0]) if found else None
    if resolved_id is None:
        return
    cur.execute(
        """
        SELECT role
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": resolved_id},
    )
    role_row = cur.fetchone()
    role = (role_row[0] if role_row else None) or "user"
    sync_subscription_entitlement_grants(
        cur,
        user_id=int(resolved_id),
        role=role,
        subscription_status=status_value,
        subscription_type=type_value,
    )


@router.get("/plan", response_model=BillingPlanResponse)
def billing_plan():
    """
    Plan marketing card + live Stripe price (when configured).

    Public so the Subscribe page can show name/price/features before checkout.
    """
    features = list(PLAN_FEATURES)
    type_label = default_subscription_type()
    try:
        secret_key, price_id = require_stripe_config()
    except ValueError:
        return BillingPlanResponse(
            name=PLAN_DISPLAY_NAME,
            type=type_label,
            tagline=PLAN_TAGLINE,
            features=features,
            price_display="—",
            stripe_configured=False,
        )

    stripe.api_key = secret_key
    try:
        price = stripe.Price.retrieve(price_id)
    except stripe.StripeError as e:
        logger.warning("stripe price retrieve failed: %s", e)
        return BillingPlanResponse(
            name=PLAN_DISPLAY_NAME,
            type=type_label,
            tagline=PLAN_TAGLINE,
            features=features,
            price_display="—",
            stripe_configured=True,
        )

    price_data = price if isinstance(price, dict) else price.to_dict()
    unit_amount = price_data.get("unit_amount")
    currency = (price_data.get("currency") or "usd").lower()
    recurring = price_data.get("recurring") or {}
    interval = recurring.get("interval") if isinstance(recurring, dict) else None

    if unit_amount is None:
        price_display = "—"
    else:
        money = _format_money(int(unit_amount), currency)
        if interval:
            price_display = f"{money} / {interval}"
        else:
            price_display = money

    primary = resolve_subscription_offer(None)
    return BillingPlanResponse(
        name=PLAN_DISPLAY_NAME,
        type=type_label,
        tagline=PLAN_TAGLINE,
        features=features,
        price_display=price_display,
        currency=currency,
        unit_amount=int(unit_amount) if unit_amount is not None else None,
        interval=interval,
        stripe_configured=True,
        offer_id=primary.id,
        print_downloads_per_month=primary.print_downloads_per_month,
        price_configured=True,
    )


@router.get("/plans", response_model=BillingPlansResponse)
def billing_plans():
    """All subscription tiers for the Subscribe page picker."""
    secret = stripe_secret_key()
    any_price = False
    plans: list[BillingPlanResponse] = []
    for offer in subscription_offers():
        price_id = resolve_price_id(offer)
        price_ok = bool(secret and price_id)
        if price_ok:
            any_price = True
        plans.append(
            BillingPlanResponse(
                name=offer.label,
                type=offer_type_label(offer),
                tagline=offer.tagline,
                features=list(offer.features),
                price_display=format_offer_price_display(offer),
                currency="usd",
                unit_amount=offer.display_amount_cents,
                interval=offer.display_interval,
                stripe_configured=price_ok,
                offer_id=offer.id,
                print_downloads_per_month=offer.print_downloads_per_month,
                price_configured=price_ok,
            )
        )
    return BillingPlansResponse(
        plans=plans,
        stripe_configured=bool(secret and any_price),
    )


@router.get("/status", response_model=BillingStatusResponse)
def billing_status(user_id: int = Depends(get_current_user_id)):
    """Return the caller's subscription entitlement snapshot."""
    try:
        secret, price = "", ""
        try:
            secret, price = require_stripe_config()
            configured = bool(secret and price)
        except ValueError:
            configured = False

        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_billing(cur, user_id)
    except OperationalError as e:
        raise _db_unavailable(e) from e

    if row is None:
        raise HTTPException(status_code=404, detail="user_not_found")

    role = row[2]
    sub_status = row[4] or "none"
    sub_type = row[5] or ""
    period_end = row[6]
    cancel_at_period_end = bool(row[7]) if len(row) > 7 else False
    return BillingStatusResponse(
        subscription_status=sub_status,
        subscription_type=sub_type,
        subscription_current_period_end=(
            period_end.isoformat() if period_end is not None else None
        ),
        cancel_at_period_end=cancel_at_period_end,
        is_subscribed=is_subscription_entitled(
            role=role, subscription_status=sub_status
        ),
        stripe_configured=configured,
    )


@router.post("/checkout", response_model=CheckoutSessionResponse)
def create_checkout_session(
    body: CheckoutSessionRequest | None = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    Create a Stripe Checkout Session (subscription mode) and return its URL.

    Client should redirect the browser to ``url``.
    """
    req = body or CheckoutSessionRequest()
    try:
        secret_key, price_id, offer = require_offer_stripe_config(
            req.offer_id
        )
    except ValueError as e:
        detail = str(e)
        if detail.startswith("unknown_subscription_offer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail,
            ) from e
        if detail == "stripe_price_missing_for_offer":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=detail,
            ) from e
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e

    stripe.api_key = secret_key
    base = resolve_frontend_origin(req.return_origin)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_billing(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="user_not_found")

                # row: id, email, role, customer_id, status, type, period_end, cancel_at_period_end
                email = row[1]
                role = row[2]
                customer_id = row[3]
                if is_staff_role(role):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="admin_already_entitled",
                    )

                customer_id = _ensure_stripe_customer(
                    cur,
                    user_id=user_id,
                    email=email,
                    existing_customer_id=customer_id,
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except stripe.StripeError as e:
        logger.warning("stripe customer create failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_customer_failed",
        ) from e

    success = f"{base}/plans/pay/{offer.id}?success=1"
    cancel = f"{base}/plans/pay/{offer.id}?canceled=1"

    try:
        _cancel_incomplete_subscriptions(customer_id)
        existing = _find_changeable_subscription(customer_id)
        replacing_id = ""
        if existing is not None:
            current_price = _subscription_primary_price_id(existing)
            if current_price == price_id:
                _persist_user_subscription(
                    user_id=user_id,
                    customer_id=customer_id,
                    sub=existing,
                )
                return CheckoutSessionResponse(url=success)
            replacing_id = stripe_resource_id(existing) or ""

        checkout_metadata: dict[str, str] = {
            "user_id": str(user_id),
            "offer_id": offer.id,
        }
        if replacing_id:
            checkout_metadata["replacing_subscription_id"] = (
                replacing_id
            )

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success,
            cancel_url=cancel,
            client_reference_id=str(user_id),
            metadata=checkout_metadata,
            subscription_data={"metadata": checkout_metadata},
            allow_promotion_codes=True,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        ) from e
    except stripe.StripeError as e:
        logger.warning("stripe checkout create failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_checkout_failed",
        ) from e

    url = session.get("url") if isinstance(session, dict) else session.url
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_checkout_missing_url",
        )
    return CheckoutSessionResponse(url=url)


@router.post("/portal", response_model=PortalSessionResponse)
def create_portal_session(
    body: PortalSessionRequest | None = None,
    user_id: int = Depends(get_current_user_id),
):
    """Open the Stripe Customer Portal (cancel / update payment method)."""
    try:
        secret_key, _price = require_stripe_config()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e

    stripe.api_key = secret_key
    req = body or PortalSessionRequest()
    base = resolve_frontend_origin(req.return_origin)

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_billing(cur, user_id)
    except OperationalError as e:
        raise _db_unavailable(e) from e

    if row is None:
        raise HTTPException(status_code=404, detail="user_not_found")
    customer_id = row[3]
    if not customer_id:
        raise HTTPException(status_code=400, detail="no_stripe_customer")

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{base}/subscription",
        )
    except stripe.StripeError as e:
        logger.warning("stripe portal create failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_portal_failed",
        ) from e

    url = session.get("url") if isinstance(session, dict) else session.url
    if not url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_portal_missing_url",
        )
    return PortalSessionResponse(url=url)


@router.get("/config", response_model=BillingConfigResponse)
def billing_config():
    """Publishable key for Payment Element (never the secret key)."""
    try:
        secret_key, price_id = require_stripe_config()
        configured = bool(secret_key and price_id)
    except ValueError:
        configured = False
    return BillingConfigResponse(
        publishable_key=stripe_publishable_key() if configured else "",
        stripe_configured=configured,
    )


def _cancel_incomplete_subscriptions(customer_id: str) -> None:
    listed = stripe.Subscription.list(
        customer=customer_id,
        status="incomplete",
        limit=10,
    )
    data = listed.get("data") if isinstance(listed, dict) else listed.data
    for item in data or []:
        sub_id = stripe_resource_id(item)
        if not sub_id:
            continue
        try:
            stripe.Subscription.cancel(sub_id)
        except stripe.StripeError:
            logger.warning("could not cancel incomplete sub %s", sub_id)


def _find_changeable_subscription(customer_id: str) -> Any | None:
    """Prefer active/trialing/past_due subscription for plan changes."""
    for status_name in ("active", "trialing", "past_due"):
        listed = stripe.Subscription.list(
            customer=customer_id,
            status=status_name,
            limit=5,
            expand=["data.items.data.price"],
        )
        data = listed.get("data") if isinstance(listed, dict) else listed.data
        if data:
            return data[0]
    return None


def _subscription_primary_price_id(sub: Any) -> str:
    data = _as_dict(sub)
    items = _as_dict(data.get("items")).get("data") or []
    if not items:
        return ""
    price = _as_dict(items[0]).get("price")
    if isinstance(price, str):
        return price.strip()
    return str(_as_dict(price).get("id") or "").strip()


def _create_subscription_requiring_payment(
    *,
    customer_id: str,
    price_id: str,
    user_id: int,
    offer_id: str,
    replacing_subscription_id: str | None = None,
) -> Any:
    """
    Start a new incomplete subscription that must be confirmed with
    Payment Element / Checkout. Used for first subscribe and for plan
    changes so a switch always charges the new plan (no free prorated
    modify).
    """
    metadata: dict[str, str] = {
        "user_id": str(user_id),
        "offer_id": offer_id,
    }
    replaced = (replacing_subscription_id or "").strip()
    if replaced:
        metadata["replacing_subscription_id"] = replaced

    return stripe.Subscription.create(
        customer=customer_id,
        items=[{"price": price_id}],
        payment_behavior="default_incomplete",
        payment_settings={
            "save_default_payment_method": "on_subscription",
        },
        expand=[
            "latest_invoice.confirmation_secret",
            "latest_invoice.payment_intent",
        ],
        metadata=metadata,
    )


def _cancel_replaced_subscription(sub: Any) -> None:
    """
    After a paid plan-change sub becomes active, cancel the prior plan
    named in metadata.replacing_subscription_id.
    """
    data = _as_dict(sub)
    status_name = str(data.get("status") or "")
    if status_name not in ("active", "trialing"):
        return

    meta = _as_dict(data.get("metadata"))
    old_id = str(meta.get("replacing_subscription_id") or "").strip()
    if not old_id:
        return

    new_id = stripe_resource_id(sub) or ""
    if old_id == new_id:
        return

    try:
        stripe.Subscription.cancel(old_id)
    except stripe.StripeError as e:
        logger.warning(
            "could not cancel replaced sub %s: %s",
            old_id,
            e,
        )


def _persist_user_subscription(
    *,
    user_id: int,
    customer_id: str,
    sub: Any,
) -> None:
    """
    Write Stripe subscription fields onto users without waiting for webhook.
    Best-effort: log and continue if the DB is briefly unavailable.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                _apply_retrieved_subscription(
                    cur,
                    sub=sub,
                    user_id=user_id,
                    customer_id=customer_id,
                )
            conn.commit()
    except OperationalError as e:
        logger.warning(
            "persist subscription after stripe change failed: %s",
            e,
        )


def _payment_intent_client_secret(sub: Any) -> tuple[str, str]:
    """
    Return (subscription_id, client_secret) from an incomplete Subscription.

    Basil+ Stripe APIs expose the Payment Element secret on
    ``latest_invoice.confirmation_secret``. Older APIs used
    ``latest_invoice.payment_intent.client_secret``.
    """
    sub_data = _as_dict(sub)
    subscription_id = str(sub_data.get("id") or "")
    invoice = sub_data.get("latest_invoice")
    if isinstance(invoice, str) and invoice:
        invoice = stripe.Invoice.retrieve(
            invoice,
            expand=[
                "confirmation_secret",
                "payment_intent",
            ],
        )
    inv_data = _as_dict(invoice)

    client_secret = ""
    confirmation = _as_dict(inv_data.get("confirmation_secret"))
    client_secret = str(
        confirmation.get("client_secret") or ""
    ).strip()

    if not client_secret:
        payment_intent = inv_data.get("payment_intent")
        if isinstance(payment_intent, str) and payment_intent:
            payment_intent = stripe.PaymentIntent.retrieve(
                payment_intent
            )
        pi_data = _as_dict(payment_intent)
        client_secret = str(
            pi_data.get("client_secret") or ""
        ).strip()

    if not subscription_id or not client_secret:
        raise ValueError("subscription_intent_missing_secret")
    return subscription_id, client_secret


@router.post(
    "/subscription/intent",
    response_model=SubscriptionIntentResponse,
)
def create_subscription_intent(
    body: SubscriptionIntentRequest | None = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    Start an on-site Payment Element subscription (incomplete → confirm).

    Redirect Checkout remains available via POST /billing/checkout.
    """
    req = body or SubscriptionIntentRequest()
    try:
        secret_key, price_id, offer = require_offer_stripe_config(
            req.offer_id
        )
    except ValueError as e:
        detail = str(e)
        if detail.startswith("unknown_subscription_offer"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail,
            ) from e
        if detail == "stripe_price_missing_for_offer":
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=detail,
            ) from e
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e
    if not stripe_publishable_key():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_publishable_key_missing",
        )

    stripe.api_key = secret_key
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_billing(cur, user_id)
                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="user_not_found",
                    )
                email = row[1]
                role = row[2]
                customer_id = row[3]
                if is_staff_role(role):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="admin_already_entitled",
                    )
                customer_id = _ensure_stripe_customer(
                    cur,
                    user_id=user_id,
                    email=email,
                    existing_customer_id=customer_id,
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except stripe.StripeError as e:
        logger.warning("stripe customer create failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_customer_failed",
        ) from e

    try:
        _cancel_incomplete_subscriptions(customer_id)
        existing = _find_changeable_subscription(customer_id)
        replacing_id: str | None = None
        if existing is not None:
            current_price = _subscription_primary_price_id(existing)
            if current_price == price_id:
                sub_id = stripe_resource_id(existing) or ""
                # Refresh local tier even when Stripe price is unchanged.
                _persist_user_subscription(
                    user_id=user_id,
                    customer_id=customer_id,
                    sub=existing,
                )
                return SubscriptionIntentResponse(
                    client_secret="",
                    offer_id=offer.id,
                    subscription_id=sub_id,
                    payment_required=False,
                    already_on_plan=True,
                )
            replacing_id = stripe_resource_id(existing) or None

        # New subscribe OR plan change: always charge the target price.
        # Do not persist incomplete change onto users — old plan stays
        # until payment succeeds and the replaced sub is canceled.
        sub = _create_subscription_requiring_payment(
            customer_id=customer_id,
            price_id=price_id,
            user_id=user_id,
            offer_id=offer.id,
            replacing_subscription_id=replacing_id,
        )
        subscription_id, client_secret = (
            _payment_intent_client_secret(sub)
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        ) from e
    except stripe.StripeError as e:
        logger.warning("stripe subscription intent failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_subscription_intent_failed",
        ) from e

    return SubscriptionIntentResponse(
        client_secret=client_secret,
        offer_id=offer.id,
        subscription_id=subscription_id,
        payment_required=bool(client_secret),
        already_on_plan=False,
    )


def _user_print_quota_limit(cur, user_id: int) -> int | None:
    """
    Free print PDFs allowed this calendar month.

    None = unlimited (staff, admin grant, or Level 3).
    0 = no free prints (must pay per download).
    N = N free downloads per UTC month.
    """
    cur.execute(
        """
        SELECT role, subscription_status, subscription_type
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    row = cur.fetchone()
    if row is None:
        return 0
    role = row[0] or "user"
    sub_status = row[1] or "none"
    sub_type = (row[2] or "").strip()
    if is_staff_role(role):
        return None
    granted = load_granted_feature_keys(cur, user_id)
    if FEATURE_DECK_PRINTOUT in granted:
        return None
    if not is_subscription_entitled(
        role=role,
        subscription_status=sub_status,
    ):
        return 0
    offer = offer_for_subscription_type_label(sub_type)
    if offer is None:
        # Entitled but type not mapped — use Level 1 quota.
        return 5
    return offer.print_downloads_per_month


def _print_quota_used_this_month(cur, user_id: int) -> int:
    cur.execute(
        """
        SELECT COUNT(*)::int
          FROM print_quota_redemptions
         WHERE user_id = %(user_id)s
           AND created_at >= date_trunc(
               'month',
               NOW() AT TIME ZONE 'UTC'
           )
        """,
        {"user_id": user_id},
    )
    return int(cur.fetchone()[0] or 0)


def _user_print_entitled_free(cur, user_id: int) -> bool:
    """True when a free (quota / unlimited) print is still available."""
    limit = _user_print_quota_limit(cur, user_id)
    if limit is None:
        return True
    if limit <= 0:
        return False
    used = _print_quota_used_this_month(cur, user_id)
    return used < limit


def _redeem_print_quota(cur, *, user_id: int, deck_id: int) -> bool:
    """
    Consume one free monthly print if quota allows.

    Unlimited tiers return True without inserting a row.
    """
    limit = _user_print_quota_limit(cur, user_id)
    if limit is None:
        return True
    if limit <= 0:
        return False
    cur.execute(
        """
        SELECT id
          FROM users
         WHERE id = %(user_id)s
         FOR UPDATE
        """,
        {"user_id": user_id},
    )
    if cur.fetchone() is None:
        return False
    used = _print_quota_used_this_month(cur, user_id)
    if used >= limit:
        return False
    cur.execute(
        """
        INSERT INTO print_quota_redemptions (user_id, deck_id)
        VALUES (%(user_id)s, %(deck_id)s)
        """,
        {"user_id": user_id, "deck_id": deck_id},
    )
    return True


def _deck_print_card_count(cur, deck_id: int) -> int:
    cur.execute(
        """
        SELECT COALESCE(SUM(quantity), 0)::int
          FROM deck_has_cards
         WHERE deck_id = %(deck_id)s
        """,
        {"deck_id": deck_id},
    )
    return int(cur.fetchone()[0] or 0)


def _format_usd_cents(amount_cents: int) -> str:
    return _format_money(amount_cents, "usd")


def _upsert_print_grant(
    cur,
    *,
    user_id: int,
    deck_id: int,
    payment_intent_id: str,
    card_count: int,
    amount_cents: int,
) -> int:
    expires = datetime.now(UTC) + PRINT_GRANT_TTL
    cur.execute(
        """
        INSERT INTO print_download_grants (
            user_id, deck_id, payment_intent_id,
            card_count, amount_cents, expires_at
        )
        VALUES (
            %(user_id)s, %(deck_id)s, %(payment_intent_id)s,
            %(card_count)s, %(amount_cents)s, %(expires_at)s
        )
        ON CONFLICT (payment_intent_id) DO UPDATE
           SET expires_at = EXCLUDED.expires_at
     RETURNING id
        """,
        {
            "user_id": user_id,
            "deck_id": deck_id,
            "payment_intent_id": payment_intent_id,
            "card_count": card_count,
            "amount_cents": amount_cents,
            "expires_at": expires,
        },
    )
    return int(cur.fetchone()[0])


@router.get(
    "/print/quote/{deck_id}",
    response_model=PrintQuoteResponse,
)
def print_quote(
    deck_id: int,
    user_id: int = Depends(get_current_user_id),
):
    if deck_id <= 0:
        raise HTTPException(status_code=404, detail="deck_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_readable_deck(
                    cur,
                    deck_id=deck_id,
                    user_id=user_id,
                )
                entitled = _user_print_entitled_free(cur, user_id)
                count = _deck_print_card_count(cur, deck_id)
                amount = 0 if entitled else print_amount_cents(count)
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    return PrintQuoteResponse(
        deck_id=deck_id,
        card_count=count,
        amount_cents=amount,
        amount_display=(
            "Free" if entitled else _format_usd_cents(amount)
        ),
        entitled_free=entitled,
    )


@router.post("/print/intent", response_model=PrintIntentResponse)
def create_print_intent(
    body: PrintIntentRequest,
    user_id: int = Depends(get_current_user_id),
):
    if body.deck_id <= 0:
        raise HTTPException(status_code=404, detail="deck_not_found")
    try:
        secret_key, _price = require_stripe_config()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e
    if not stripe_publishable_key():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_publishable_key_missing",
        )

    stripe.api_key = secret_key
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_readable_deck(
                    cur,
                    deck_id=body.deck_id,
                    user_id=user_id,
                )
                if _user_print_entitled_free(cur, user_id):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="print_already_entitled",
                    )
                row = _fetch_user_billing(cur, user_id)
                if row is None:
                    raise HTTPException(
                        status_code=404,
                        detail="user_not_found",
                    )
                email = row[1]
                customer_id = row[3]
                count = _deck_print_card_count(cur, body.deck_id)
                if count <= 0:
                    raise HTTPException(
                        status_code=400,
                        detail="deck_empty",
                    )
                amount = print_amount_cents(count)
                customer_id = _ensure_stripe_customer(
                    cur,
                    user_id=user_id,
                    email=email,
                    existing_customer_id=customer_id,
                )
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except stripe.StripeError as e:
        logger.warning("stripe customer create failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_customer_failed",
        ) from e

    try:
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            customer=customer_id,
            automatic_payment_methods={"enabled": True},
            metadata={
                "user_id": str(user_id),
                "deck_id": str(body.deck_id),
                "offer_id": "deck_print_download",
                "card_count": str(count),
                "amount_cents": str(amount),
            },
        )
    except stripe.StripeError as e:
        logger.warning("stripe print intent failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_print_intent_failed",
        ) from e

    pi = _as_dict(intent)
    client_secret = str(pi.get("client_secret") or "").strip()
    payment_intent_id = str(pi.get("id") or "").strip()
    if not client_secret or not payment_intent_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_print_intent_missing_secret",
        )
    return PrintIntentResponse(
        client_secret=client_secret,
        payment_intent_id=payment_intent_id,
        deck_id=body.deck_id,
        card_count=count,
        amount_cents=amount,
        amount_display=_format_usd_cents(amount),
    )


@router.post("/print/confirm", response_model=PrintAccessResponse)
def confirm_print_payment(
    body: PrintConfirmRequest,
    user_id: int = Depends(get_current_user_id),
):
    """Record a paid print grant after Payment Element confirms (webhook backup)."""
    pi_id = (body.payment_intent_id or "").strip()
    if not pi_id:
        raise HTTPException(status_code=400, detail="payment_intent_required")
    try:
        secret_key, _price = require_stripe_config()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e

    stripe.api_key = secret_key
    try:
        intent = stripe.PaymentIntent.retrieve(pi_id)
    except stripe.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_retrieve_failed",
        ) from e

    pi = _as_dict(intent)
    if str(pi.get("status") or "") != "succeeded":
        raise HTTPException(
            status_code=400,
            detail="payment_not_succeeded",
        )
    meta = _as_dict(pi.get("metadata"))
    try:
        meta_user = int(meta.get("user_id"))
        deck_id = int(meta.get("deck_id"))
        card_count_val = int(meta.get("card_count") or 0)
        amount_cents = int(meta.get("amount_cents") or pi.get("amount") or 0)
    except (TypeError, ValueError) as e:
        raise HTTPException(
            status_code=400,
            detail="invalid_payment_metadata",
        ) from e
    if meta_user != user_id:
        raise HTTPException(status_code=403, detail="payment_user_mismatch")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                if _user_print_entitled_free(cur, user_id):
                    return PrintAccessResponse(
                        allowed=True,
                        entitled_free=True,
                    )
                grant_id = _upsert_print_grant(
                    cur,
                    user_id=user_id,
                    deck_id=deck_id,
                    payment_intent_id=pi_id,
                    card_count=card_count_val,
                    amount_cents=amount_cents,
                )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e

    return PrintAccessResponse(
        allowed=True,
        entitled_free=False,
        grant_id=grant_id,
    )


@router.get(
    "/print/access/{deck_id}",
    response_model=PrintAccessResponse,
)
def print_access(
    deck_id: int,
    user_id: int = Depends(get_current_user_id),
):
    if deck_id <= 0:
        raise HTTPException(status_code=404, detail="deck_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_readable_deck(
                    cur,
                    deck_id=deck_id,
                    user_id=user_id,
                )
                if _user_print_entitled_free(cur, user_id):
                    return PrintAccessResponse(
                        allowed=True,
                        entitled_free=True,
                    )
                cur.execute(
                    """
                    SELECT id
                      FROM print_download_grants
                     WHERE user_id = %(user_id)s
                       AND deck_id = %(deck_id)s
                       AND expires_at > NOW()
                     ORDER BY created_at DESC
                     LIMIT 1
                    """,
                    {"user_id": user_id, "deck_id": deck_id},
                )
                row = cur.fetchone()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e

    if row is None:
        return PrintAccessResponse(allowed=False, entitled_free=False)
    return PrintAccessResponse(
        allowed=True,
        entitled_free=False,
        grant_id=int(row[0]),
    )


@router.post(
    "/print/redeem/{deck_id}",
    response_model=PrintAccessResponse,
)
def redeem_print_download(
    deck_id: int,
    user_id: int = Depends(get_current_user_id),
):
    """
    Spend one free monthly print (or allow unlimited / paid grant).

    Call this immediately before generating the PDF so L1/L2 quotas
    cannot be bypassed by repeating CREATE PRINTOUT.
    """
    if deck_id <= 0:
        raise HTTPException(status_code=404, detail="deck_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                require_readable_deck(
                    cur,
                    deck_id=deck_id,
                    user_id=user_id,
                )
                if _redeem_print_quota(
                    cur,
                    user_id=user_id,
                    deck_id=deck_id,
                ):
                    conn.commit()
                    return PrintAccessResponse(
                        allowed=True,
                        entitled_free=True,
                    )
                cur.execute(
                    """
                    SELECT id
                      FROM print_download_grants
                     WHERE user_id = %(user_id)s
                       AND deck_id = %(deck_id)s
                       AND expires_at > NOW()
                     ORDER BY created_at DESC
                     LIMIT 1
                    """,
                    {"user_id": user_id, "deck_id": deck_id},
                )
                row = cur.fetchone()
            conn.commit()
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e

    if row is None:
        return PrintAccessResponse(allowed=False, entitled_free=False)
    return PrintAccessResponse(
        allowed=True,
        entitled_free=False,
        grant_id=int(row[0]),
    )


def _subscription_fields(sub: Any) -> tuple[str, str, Any, bool]:
    """Return (subscription_id, status, period_end, cancel_at_period_end)."""
    if isinstance(sub, dict):
        sub_id = sub.get("id")
        sub_status = sub.get("status")
    else:
        sub_id = getattr(sub, "id", None)
        sub_status = getattr(sub, "status", None)
    return (
        str(sub_id or ""),
        str(sub_status or "none"),
        period_end_from_subscription(sub),
        cancel_at_period_end_from_subscription(sub),
    )


def _apply_retrieved_subscription(
    cur,
    *,
    sub: Any,
    user_id: int | None = None,
    customer_id: str | None = None,
) -> None:
    subscription_id, sub_status, period_end, cancel_at_period_end = _subscription_fields(
        sub
    )
    if not subscription_id:
        return
    # Plan-change payments land here via sync/webhook — drop the old plan.
    _cancel_replaced_subscription(sub)
    _apply_subscription_row(
        cur,
        user_id=user_id,
        customer_id=customer_id,
        subscription_id=subscription_id,
        subscription_status=sub_status,
        subscription_type=subscription_type_from_subscription(sub),
        period_end=period_end,
        cancel_at_period_end=cancel_at_period_end,
    )


def _sync_customer_subscriptions(cur, *, customer_id: str, user_id: int | None = None) -> int:
    """Pull subscriptions for a Stripe customer and write the newest entitled one."""
    # Expand depth max is 4; product would be a 5th level under data.items.data.price.
    subs = stripe.Subscription.list(
        customer=customer_id,
        status="all",
        limit=10,
        expand=["data.items.data.price"],
    )
    data = subs.get("data") if isinstance(subs, dict) else list(subs.data)
    if not data:
        return 0

    # Prefer active/trialing; otherwise take the most recently created.
    preferred = [
        s
        for s in data
        if (s.get("status") if isinstance(s, dict) else s.status)
        in ("active", "trialing", "past_due")
    ]
    chosen = preferred[0] if preferred else data[0]
    cust = customer_id
    if user_id is None:
        _apply_retrieved_subscription(cur, sub=chosen, customer_id=cust)
    else:
        _apply_retrieved_subscription(cur, sub=chosen, user_id=user_id, customer_id=cust)
    return 1


@router.post("/sync", response_model=BillingStatusResponse)
def sync_billing_from_stripe(user_id: int = Depends(get_current_user_id)):
    """
    Pull the caller's Stripe subscriptions into the local users row.

    Use after a missed webhook (common in local dev when `stripe listen` was down).
    """
    try:
        secret_key, _price = require_stripe_config()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e

    stripe.api_key = secret_key

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                row = _fetch_user_billing(cur, user_id)
                if row is None:
                    raise HTTPException(status_code=404, detail="user_not_found")
                customer_id = row[3]
                if not customer_id:
                    raise HTTPException(status_code=400, detail="no_stripe_customer")
                _sync_customer_subscriptions(
                    cur, customer_id=customer_id, user_id=user_id
                )
            conn.commit()

            with conn.cursor() as cur:
                row = _fetch_user_billing(cur, user_id)
    except HTTPException:
        raise
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except stripe.StripeError as e:
        logger.warning("stripe sync failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_sync_failed",
        ) from e

    if row is None:
        raise HTTPException(status_code=404, detail="user_not_found")

    role = row[2]
    sub_status = row[4] or "none"
    sub_type = row[5] or ""
    period_end = row[6]
    cancel_at_period_end = bool(row[7]) if len(row) > 7 else False
    return BillingStatusResponse(
        subscription_status=sub_status,
        subscription_type=sub_type,
        subscription_current_period_end=(
            period_end.isoformat() if period_end is not None else None
        ),
        cancel_at_period_end=cancel_at_period_end,
        is_subscribed=is_subscription_entitled(
            role=role, subscription_status=sub_status
        ),
        stripe_configured=True,
    )


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """
    Stripe → Mirror Image sync.

    Verify the signature, then update users.subscription_* from subscription events.
    Never trust the browser for entitlement — only this webhook (and /status reads).
    """
    try:
        secret_key, _price = require_stripe_config()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e

    wh_secret = stripe_webhook_secret()
    if not wh_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_webhook_not_configured",
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    stripe.api_key = secret_key
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, wh_secret)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="invalid_payload") from e
    except stripe.SignatureVerificationError as e:
        raise HTTPException(status_code=400, detail="invalid_signature") from e

    event_type = event["type"]
    # Webhook payloads are StripeObjects — .get() is not a dict method on them.
    data_object = _as_dict(event["data"]["object"])

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                if event_type == "checkout.session.completed":
                    metadata = _as_dict(data_object.get("metadata"))
                    user_id_raw = metadata.get("user_id") or data_object.get(
                        "client_reference_id"
                    )
                    customer_id = stripe_resource_id(data_object.get("customer"))
                    subscription_id = stripe_resource_id(
                        data_object.get("subscription")
                    )
                    if user_id_raw and subscription_id:
                        try:
                            user_id = int(user_id_raw)
                        except (TypeError, ValueError):
                            user_id = None
                        if user_id is not None:
                            sub = stripe.Subscription.retrieve(
                                subscription_id,
                                expand=["items.data.price.product"],
                            )
                            _apply_retrieved_subscription(
                                cur, sub=sub, user_id=user_id, customer_id=customer_id
                            )
                            if customer_id:
                                cur.execute(
                                    """
                                    UPDATE users
                                       SET stripe_customer_id = %(customer_id)s,
                                           updated_at = NOW()
                                     WHERE id = %(user_id)s
                                       AND (
                                           stripe_customer_id IS NULL
                                           OR stripe_customer_id = %(customer_id)s
                                       )
                                    """,
                                    {
                                        "customer_id": customer_id,
                                        "user_id": user_id,
                                    },
                                )

                elif event_type in (
                    "customer.subscription.updated",
                    "customer.subscription.created",
                    "customer.subscription.deleted",
                ):
                    customer_id = stripe_resource_id(data_object.get("customer"))
                    subscription_id = stripe_resource_id(data_object.get("id"))
                    sub_status = data_object.get("status") or "none"
                    tier = subscription_type_from_subscription(data_object)
                    if event_type == "customer.subscription.deleted":
                        sub_status = "canceled"
                        tier = ""
                    else:
                        _cancel_replaced_subscription(data_object)
                    _apply_subscription_row(
                        cur,
                        customer_id=customer_id,
                        subscription_id=subscription_id,
                        subscription_status=sub_status,
                        subscription_type=tier,
                        period_end=period_end_from_subscription(data_object),
                        cancel_at_period_end=(
                            False
                            if event_type == "customer.subscription.deleted"
                            else cancel_at_period_end_from_subscription(data_object)
                        ),
                    )

                elif event_type in ("invoice.paid", "invoice_payment.paid"):
                    # Payment succeeded — sync subscription if present on the invoice.
                    customer_id = stripe_resource_id(data_object.get("customer"))
                    subscription_id = stripe_resource_id(
                        data_object.get("subscription")
                    )
                    if not subscription_id and event_type == "invoice_payment.paid":
                        # Newer object shape may nest the invoice id only.
                        invoice_id = stripe_resource_id(data_object.get("invoice"))
                        if invoice_id:
                            invoice = stripe.Invoice.retrieve(invoice_id)
                            inv = (
                                invoice
                                if isinstance(invoice, dict)
                                else invoice.to_dict()
                            )
                            customer_id = customer_id or stripe_resource_id(
                                inv.get("customer")
                            )
                            subscription_id = stripe_resource_id(
                                inv.get("subscription")
                            )
                    if subscription_id:
                        sub = stripe.Subscription.retrieve(
                            subscription_id,
                            expand=["items.data.price.product"],
                        )
                        _apply_retrieved_subscription(
                            cur, sub=sub, customer_id=customer_id
                        )
                    elif customer_id:
                        _sync_customer_subscriptions(cur, customer_id=customer_id)

                elif event_type == "payment_intent.succeeded":
                    meta = _as_dict(data_object.get("metadata"))
                    if meta.get("offer_id") != "deck_print_download":
                        pass
                    else:
                        try:
                            uid = int(meta.get("user_id"))
                            deck_id = int(meta.get("deck_id"))
                            card_count_val = int(
                                meta.get("card_count") or 0
                            )
                            amount_cents = int(
                                meta.get("amount_cents")
                                or data_object.get("amount")
                                or 0
                            )
                        except (TypeError, ValueError):
                            uid = 0
                            deck_id = 0
                            card_count_val = 0
                            amount_cents = 0
                        pi_id = stripe_resource_id(
                            data_object.get("id")
                        )
                        if uid > 0 and deck_id > 0 and pi_id:
                            _upsert_print_grant(
                                cur,
                                user_id=uid,
                                deck_id=deck_id,
                                payment_intent_id=pi_id,
                                card_count=card_count_val,
                                amount_cents=amount_cents,
                            )
            conn.commit()
    except OperationalError as e:
        raise _db_unavailable(e) from e
    except stripe.StripeError as e:
        logger.warning("stripe webhook follow-up failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="stripe_webhook_followup_failed",
        ) from e

    return {"received": True}
