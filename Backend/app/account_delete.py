"""Self-serve and admin account purge.

Stripe is cancelled before any row is removed. Decks linked only to this
user are deleted; shared decks keep other owners. Then the user row goes,
and FK CASCADE clears grants, tokens, oauth, and user_has_decks.
"""

from __future__ import annotations

import logging

import stripe
from psycopg2.extensions import cursor as PgCursor

from app.subscription import stripe_secret_key

logger = logging.getLogger(__name__)


class AccountDeleteError(Exception):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


def usernames_match(typed: str, stored: str) -> bool:
    return typed == stored


def _count_active_admins(cur: PgCursor) -> int:
    cur.execute(
        """
        SELECT COUNT(*)
          FROM users
         WHERE role = 'admin'
           AND is_active = TRUE
        """
    )
    row = cur.fetchone()
    return int(row[0]) if row else 0


def load_user_for_purge(
    cur: PgCursor, *, user_id: int
) -> tuple[str, str, str | None, str | None] | None:
    """Return (user_name, role, stripe_customer_id, stripe_subscription_id)."""
    cur.execute(
        """
        SELECT user_name, role, stripe_customer_id, stripe_subscription_id
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    row = cur.fetchone()
    if row is None:
        return None
    return (
        str(row[0]),
        str(row[1]),
        row[2],
        row[3],
    )


def cancel_stripe_for_user(
    *, customer_id: str | None, subscription_id: str | None
) -> None:
    if not customer_id:
        return

    key = stripe_secret_key()
    if not key:
        raise AccountDeleteError("stripe_cancel_failed")

    stripe.api_key = key
    try:
        if subscription_id:
            try:
                stripe.Subscription.cancel(subscription_id)
            except stripe.InvalidRequestError:
                pass
        else:
            for sub in stripe.Subscription.list(
                customer=customer_id, status="all", limit=20
            ).auto_paging_iter():
                status = getattr(sub, "status", None) or ""
                if status in {"canceled", "incomplete_expired"}:
                    continue
                try:
                    stripe.Subscription.cancel(sub.id)
                except stripe.InvalidRequestError:
                    pass
        stripe.Customer.delete(customer_id)
    except stripe.StripeError as exc:
        logger.warning("stripe cancel/delete failed: %s", exc)
        raise AccountDeleteError("stripe_cancel_failed") from exc


def delete_owned_decks(cur: PgCursor, *, user_id: int) -> None:
    """Remove decks that have no other owner."""
    cur.execute(
        """
        DELETE FROM decks
         WHERE id IN (
               SELECT uhd.deck_id
                 FROM user_has_decks uhd
                WHERE uhd.user_id = %(user_id)s
           )
           AND id NOT IN (
               SELECT uhd.deck_id
                 FROM user_has_decks uhd
                WHERE uhd.user_id <> %(user_id)s
           )
        """,
        {"user_id": user_id},
    )


def delete_user_row(cur: PgCursor, *, user_id: int) -> None:
    cur.execute("DELETE FROM users WHERE id = %(user_id)s", {"user_id": user_id})


def purge_account(
    cur: PgCursor,
    *,
    user_id: int,
    typed_username: str | None = None,
) -> None:
    loaded = load_user_for_purge(cur, user_id=user_id)
    if loaded is None:
        raise AccountDeleteError("user_not_found")

    user_name, role, customer_id, subscription_id = loaded
    if typed_username is not None and not usernames_match(typed_username, user_name):
        raise AccountDeleteError("username_mismatch")

    if role == "admin" and _count_active_admins(cur) <= 1:
        raise AccountDeleteError("cannot_remove_last_admin")

    cancel_stripe_for_user(
        customer_id=customer_id, subscription_id=subscription_id
    )
    delete_owned_decks(cur, user_id=user_id)
    delete_user_row(cur, user_id=user_id)
