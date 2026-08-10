"""Feature catalog keys and entitlement helpers (single source of truth)."""

from __future__ import annotations

from collections.abc import Iterable

from app.subscription import is_subscription_entitled

# Stable keys — must match rows seeded in features table.
FEATURE_PREVIEW_CARDS = "preview_cards"
FEATURE_PLAYTESTER = "playtester"

# Features unlocked automatically for Stripe active/trialing (and admins via role).
SUBSCRIBER_DEFAULT_FEATURES = frozenset({FEATURE_PREVIEW_CARDS})


def user_has_feature(
    *,
    role: str,
    subscription_status: str,
    granted_keys: Iterable[str],
    feature_key: str,
) -> bool:
    """
    True when the user may use ``feature_key``.

    Order: admin → explicit grant → subscriber defaults (Stripe entitled).
    """
    if role == "admin":
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
    wanted = sorted({k.strip() for k in feature_keys if k and k.strip()})
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
