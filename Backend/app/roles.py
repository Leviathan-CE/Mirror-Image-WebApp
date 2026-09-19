"""Account roles. Card upload is admin + developer; site admin is admin only."""

from __future__ import annotations

ROLE_USER = "user"
ROLE_ADMIN = "admin"
ROLE_DISTRIBUTOR = "distributor"
ROLE_DEVELOPER = "developer"

ALL_ROLES = frozenset(
    {ROLE_USER, ROLE_ADMIN, ROLE_DISTRIBUTOR, ROLE_DEVELOPER}
)
CARD_MANAGER_ROLES = frozenset({ROLE_ADMIN, ROLE_DEVELOPER})


def is_admin_role(role: str | None) -> bool:
    return (role or "") == ROLE_ADMIN


def can_manage_cards(role: str | None) -> bool:
    return (role or "") in CARD_MANAGER_ROLES
