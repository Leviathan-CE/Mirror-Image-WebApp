"""Feature catalog keys and entitlement helpers (single source of truth)."""

from __future__ import annotations

from collections.abc import Iterable

from app.roles import is_staff_role
from app.subscription import is_subscription_entitled

# Stable keys — must match rows seeded in features table.
FEATURE_PREVIEW_CARDS = "preview_cards"
FEATURE_UNPUBLISHED_CARDS = "unpublished_cards"
FEATURE_PLAYTESTER = "playtester"
FEATURE_DECK_PRINTOUT = "deck_printout"
FEATURE_DUPLEX_PRINT = "duplex_print"

# Always available (no account / no grant). Kept in the catalog for /auth/me
# but excluded from admin grant toggles.
PUBLIC_FEATURES = frozenset({FEATURE_PLAYTESTER})

# Baseline for any entitled Stripe sub. Tier extras (e.g. duplex_print)
# come from the matched offer's entitlements via /auth/me.
SUBSCRIBER_DEFAULT_FEATURES = frozenset({FEATURE_DECK_PRINTOUT})


def is_public_feature(feature_key: str) -> bool:
    return feature_key in PUBLIC_FEATURES


def user_has_feature(
    *,
    role: str,
    subscription_status: str,
    granted_keys: Iterable[str],
    feature_key: str,
) -> bool:
    """
    True when the user may use ``feature_key``.

    Order: public → staff (admin/developer) → explicit grant → subscriber defaults.
    """
    if feature_key in PUBLIC_FEATURES:
        return True
    if is_staff_role(role):
        return True
    granted = {k for k in granted_keys if k}
    if feature_key in granted:
        return True
    if feature_key in SUBSCRIBER_DEFAULT_FEATURES and is_subscription_entitled(
        role=role, subscription_status=subscription_status
    ):
        return True
    return False


def effective_feature_keys(
    *,
    role: str,
    subscription_status: str,
    granted_keys: Iterable[str],
    catalog_keys: Iterable[str],
) -> list[str]:
    """Intersect catalog with keys the user can use (stable sorted order)."""
    out: list[str] = []
    for key in catalog_keys:
        if user_has_feature(
            role=role,
            subscription_status=subscription_status,
            granted_keys=granted_keys,
            feature_key=key,
        ):
            out.append(key)
    return out


def load_granted_feature_keys(cur, user_id: int) -> list[str]:
    """Feature keys granted to ``user_id`` via user_feature_grants."""
    cur.execute(
        """
        SELECT f.key
          FROM user_feature_grants g
          JOIN features f ON f.id = g.feature_id
         WHERE g.user_id = %(user_id)s
         ORDER BY f.key ASC
        """,
        {"user_id": user_id},
    )
    return [row[0] for row in cur.fetchall()]


def load_feature_catalog(cur) -> list[tuple[str, str, str]]:
    """Return (key, label, description) for all features."""
    cur.execute(
        """
        SELECT key, label, description
          FROM features
         ORDER BY key ASC
        """
    )
    return [(row[0], row[1], row[2] or "") for row in cur.fetchall()]


def load_grantable_feature_catalog(cur) -> list[tuple[str, str, str]]:
    """Catalog rows admins can grant (excludes always-public features)."""
    return [
        row for row in load_feature_catalog(cur) if row[0] not in PUBLIC_FEATURES
    ]


def sync_user_feature_grants(
    cur,
    *,
    user_id: int,
    feature_keys: list[str],
    granted_by: int | None,
) -> list[str]:
    """
    Replace grants for ``user_id`` with ``feature_keys``.

    Unknown keys raise ValueError. Returns the sorted granted keys.
    """
    wanted = sorted(
        {
            k.strip()
            for k in feature_keys
            if k and k.strip() and k.strip() not in PUBLIC_FEATURES
        }
    )
    if wanted:
        cur.execute(
            """
            SELECT key, id
              FROM features
             WHERE key = ANY(%(keys)s)
            """,
            {"keys": wanted},
        )
        found = {row[0]: row[1] for row in cur.fetchall()}
        missing = [k for k in wanted if k not in found]
        if missing:
            raise ValueError(f"unknown_feature_keys:{','.join(missing)}")
    else:
        found = {}

    cur.execute(
        "DELETE FROM user_feature_grants WHERE user_id = %(user_id)s",
        {"user_id": user_id},
    )
    for key in wanted:
        cur.execute(
            """
            INSERT INTO user_feature_grants (user_id, feature_id, granted_by)
            VALUES (%(user_id)s, %(feature_id)s, %(granted_by)s)
            """,
            {
                "user_id": user_id,
                "feature_id": found[key],
                "granted_by": granted_by,
            },
        )
    return wanted


def subscription_managed_feature_keys() -> frozenset[str]:
    """Keys owned by Stripe tier entitlements (safe to add/remove on sync)."""
    from app.stripe_offers import subscription_offers

    keys: set[str] = set()
    for offer in subscription_offers():
        keys.update(offer.entitlements)
    # Never treat preview as a paid entitlement again.
    keys.discard(FEATURE_PREVIEW_CARDS)
    return frozenset(keys)


def desired_subscription_entitlements(
    *,
    role: str,
    subscription_status: str,
    subscription_type: str,
) -> set[str]:
    """
    Feature keys the caller's current Stripe tier should grant.

    Empty when not entitled. Unknown type → subscriber defaults only.
    """
    if not is_subscription_entitled(
        role=role,
        subscription_status=subscription_status,
    ):
        return set()

    from app.stripe_offers import offer_for_subscription_type_label

    offer = offer_for_subscription_type_label(subscription_type or "")
    if offer is None:
        return set(SUBSCRIBER_DEFAULT_FEATURES)
    managed = subscription_managed_feature_keys()
    return {key for key in offer.entitlements if key in managed}


def sync_subscription_entitlement_grants(
    cur,
    *,
    user_id: int,
    role: str,
    subscription_status: str,
    subscription_type: str,
) -> list[str]:
    """
    Align subscription-managed grants with the user's current tier.

    Preserves unrelated admin grants (e.g. unpublished_cards, preview_cards).
    """
    managed = subscription_managed_feature_keys()
    desired = desired_subscription_entitlements(
        role=role,
        subscription_status=subscription_status,
        subscription_type=subscription_type,
    )
    current = set(load_granted_feature_keys(cur, user_id))
    kept = current - managed
    next_keys = sorted(kept | desired)
    return sync_user_feature_grants(
        cur,
        user_id=user_id,
        feature_keys=next_keys,
        granted_by=None,
    )

