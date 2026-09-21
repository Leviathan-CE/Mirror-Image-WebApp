"""Account roles — single source of truth for CHECK + API gates."""

from __future__ import annotations

ROLE_USER = "user"
ROLE_ADMIN = "admin"
ROLE_DISTRIBUTOR = "distributor"
ROLE_DEVELOPER = "developer"

ALLOWED_ROLES = frozenset(
    {ROLE_USER, ROLE_ADMIN, ROLE_DISTRIBUTOR, ROLE_DEVELOPER}
)

# Console + card upload + catalogue bypass. Not user management.
STAFF_ROLES = frozenset({ROLE_ADMIN, ROLE_DEVELOPER})


def is_admin_role(role: str | None) -> bool:
    return role == ROLE_ADMIN


def is_staff_role(role: str | None) -> bool:
    return role in STAFF_ROLES


def is_allowed_role(role: str | None) -> bool:
    return role in ALLOWED_ROLES
