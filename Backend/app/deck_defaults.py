"""Seeded default section names for new decks (users can rename/add/remove)."""

# (name, in_deck) — in_deck piles shuffle into the RIG; others are list-only.
DEFAULT_DECK_CATEGORIES: tuple[tuple[str, bool], ...] = (
    ("Entity", True),
    ("Cyberspell", True),
)

DEFAULT_DECK_CATEGORY_NAMES: tuple[str, ...] = tuple(
    name for name, _in_deck in DEFAULT_DECK_CATEGORIES
)

RESERVED_CATEGORY_NAMES: frozenset[str] = frozenset({"pilot"})


def category_in_deck_default(name: str) -> bool:
    """Pilot never counts as the playable RIG."""
    return name.strip().lower() not in RESERVED_CATEGORY_NAMES
