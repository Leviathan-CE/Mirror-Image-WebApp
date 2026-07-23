"""Stripe Checkout + Customer Portal + webhooks for feature unlocks."""

from __future__ import annotations

import logging
from typing import Any

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from psycopg2 import OperationalError

from app.db import get_connection
from app.security import get_current_user_id
from app.settings import resolve_frontend_origin
from app.subscription import (
    PLAN_DISPLAY_NAME,
    PLAN_FEATURES,
    PLAN_TAGLINE,
    default_subscription_type,
    is_subscription_entitled,
    cancel_at_period_end_from_subscription,
    _as_dict,
    period_end_from_subscription,
    require_stripe_config,
    subscription_type_from_subscription,
    stripe_secret_key,
    stripe_webhook_secret,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])


class CheckoutSessionRequest(BaseModel):
    """Optional browser origin so cancel/success match where the user is browsing."""

    return_origin: str | None = None


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
            "subscription_status": subscription_status or "none",
            "subscription_type": (subscription_type or "").strip(),
            "period_end": period_end,
            "cancel_at_period_end": bool(cancel_at_period_end),
        },
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
    try:
        secret_key, price_id = require_stripe_config()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="stripe_not_configured",
        ) from e

    stripe.api_key = secret_key
    req = body or CheckoutSessionRequest()
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
                sub_status = row[4] or "none"
                if is_subscription_entitled(role=role, subscription_status=sub_status):
                    # Already entitled (admin or active sub) — send them to manage portal
                    # instead of double-subscribing when they have a Stripe customer.
                    if customer_id and role != "admin":
                        raise HTTPException(
                            status_code=status.HTTP_409_CONFLICT,
                            detail="already_subscribed",
                        )
                    if role == "admin":
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
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{base}/subscribe?success=1",
            cancel_url=f"{base}/subscribe?canceled=1",
            client_reference_id=str(user_id),
            metadata={"user_id": str(user_id)},
            allow_promotion_codes=True,
        )
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
            return_url=f"{base}/subscribe",
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
                    customer_id = data_object.get("customer")
                    subscription_id = data_object.get("subscription")
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
                    customer_id = data_object.get("customer")
                    subscription_id = data_object.get("id")
                    sub_status = data_object.get("status") or "none"
                    tier = subscription_type_from_subscription(data_object)
                    if event_type == "customer.subscription.deleted":
                        sub_status = "canceled"
                        tier = ""
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
                    customer_id = data_object.get("customer")
                    subscription_id = data_object.get("subscription")
                    if not subscription_id and event_type == "invoice_payment.paid":
                        # Newer object shape may nest the invoice id only.
                        invoice_id = data_object.get("invoice")
                        if invoice_id:
                            invoice = stripe.Invoice.retrieve(invoice_id)
                            inv = (
                                invoice
                                if isinstance(invoice, dict)
                                else invoice.to_dict()
                            )
                            customer_id = customer_id or inv.get("customer")
                            subscription_id = inv.get("subscription")
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
