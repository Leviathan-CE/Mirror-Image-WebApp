"""Delete an account: cancel Stripe, remove decks, then drop the user row."""

from __future__ import annotations

import logging
from typing import Any

import stripe

from app.play_rooms_state import forget_user, room_for_user, vacate_seat
from app.subscription import stripe_resource_id, stripe_secret_key

logger = logging.getLogger(__name__)

# Already-ended Stripe states — cancel is a no-op.
_STRIPE_ENDED = frozenset({"canceled", "incomplete_expired"})


class AccountDeleteError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def username_matches_for_delete(typed: str, stored: str) -> bool:
    """Exact match against the name we show in the confirm dialog."""
    if not typed or not stored:
        return False
    return typed.strip() == stored


def _stripe_status(sub: Any) -> str:
    if isinstance(sub, dict):
        return str(sub.get("status") or "")
    return str(getattr(sub, "status", "") or "")


def _is_missing_stripe_resource(exc: Exception) -> bool:
    code = getattr(exc, "code", None)
    return code == "resource_missing"


def cancel_stripe_for_user(
    *,
    customer_id: str | None,
    subscription_id: str | None,
) -> None:
    """
    Immediately cancel every subscription, then delete the Stripe customer.

    No Stripe ids → nothing to do. Ids but no API key → refuse, so we never
    delete a billed account we cannot stop charging.
    """
    customer = (customer_id or "").strip()
    subscription = (subscription_id or "").strip()
    if not customer and not subscription:
        return

    key = stripe_secret_key()
    if not key:
        raise AccountDeleteError("stripe_cancel_failed")

    stripe.api_key = key

    if customer:
        try:
            listed = stripe.Subscription.list(customer=customer, status="all", limit=100)
            rows = listed.get("data") if isinstance(listed, dict) else list(listed.data)
            for sub in rows:
                sub_id = stripe_resource_id(sub)
                if not sub_id or _stripe_status(sub) in _STRIPE_ENDED:
                    continue
                stripe.Subscription.cancel(sub_id)
        except stripe.InvalidRequestError as exc:
            if not _is_missing_stripe_resource(exc):
                logger.warning("stripe list/cancel failed: %s", exc)
                raise AccountDeleteError("stripe_cancel_failed") from exc
        try:
            stripe.Customer.delete(customer)
        except stripe.InvalidRequestError as exc:
            if not _is_missing_stripe_resource(exc):
                logger.warning("stripe customer delete failed: %s", exc)
                raise AccountDeleteError("stripe_cancel_failed") from exc
        return

    try:
        stripe.Subscription.cancel(subscription)
    except stripe.InvalidRequestError as exc:
        if _is_missing_stripe_resource(exc):
            return
        logger.warning("stripe subscription cancel failed: %s", exc)
        raise AccountDeleteError("stripe_cancel_failed") from exc


def leave_play_rooms(user_id: int) -> None:
    """Drop in-memory playtester seats so a deleted id cannot stay seated."""
    room = room_for_user(user_id)
    if room is None:
        forget_user(user_id)
        return
    for seat, holder in list(room.seats.items()):
        if holder is not None and holder.user_id == user_id:
            vacate_seat(room, seat, user_id)


def delete_owned_decks(cur, user_id: int) -> None:
    """Decks are not ON DELETE CASCADE from users — remove them first."""
    cur.execute(
        """
        DELETE FROM decks
         WHERE id IN (
            SELECT deck_id
              FROM user_has_decks
             WHERE user_id = %(user_id)s
         )
        """,
        {"user_id": user_id},
    )


def count_active_admins(cur) -> int:
    cur.execute(
        """
        SELECT COUNT(*)::int
          FROM users
         WHERE role = 'admin'
           AND is_active = TRUE
        """
    )
    return int(cur.fetchone()[0])


def load_account_delete_row(cur, user_id: int) -> tuple | None:
    cur.execute(
        """
        SELECT id, user_name, role, is_active,
               stripe_customer_id, stripe_subscription_id
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    return cur.fetchone()


def purge_user_account(cur, user_id: int) -> None:
    """Remove owned decks, then the user row (cascades grants, oauth, 2FA)."""
    delete_owned_decks(cur, user_id)
    cur.execute("DELETE FROM users WHERE id = %(user_id)s", {"user_id": user_id})


def delete_own_account(cur, *, user_id: int, typed_user_name: str) -> None:
    """
    Confirm username, refuse last-admin, cancel Stripe, then purge.

    Stripe runs before the DELETE so a billing failure leaves the account.
    """
    row = load_account_delete_row(cur, user_id)
    if row is None:
        raise AccountDeleteError("user_not_found")

    stored_name = row[1]
    role = row[2]
    is_active = bool(row[3])
    customer_id = row[4]
    subscription_id = row[5]

    if not username_matches_for_delete(typed_user_name, stored_name):
        raise AccountDeleteError("username_mismatch")

    if role == "admin" and is_active and count_active_admins(cur) <= 1:
        raise AccountDeleteError("cannot_remove_last_admin")

    cancel_stripe_for_user(
        customer_id=customer_id,
        subscription_id=subscription_id,
    )
    purge_user_account(cur, user_id)
