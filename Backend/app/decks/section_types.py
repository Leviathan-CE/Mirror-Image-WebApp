"""Section type sets for auto-filing cards in the deck builder.

A section lists the types it claims. A card is filed there when it has
every one of those types. The longest match wins, so CyberSpell + Quick
Hack beats a section that only claims CyberSpell.

The same set cannot be used twice on one deck. CyberSpell + Quick Hack
and CyberSpell + Process are different sets, so both are allowed.
"""

from __future__ import annotations


def type_token(value: str) -> str:
    return " ".join(value.strip().split())


def type_key(value: str) -> str:
    return type_token(value).casefold()


_RESERVED_SECTION_NAMES = frozenset(
    {
        "pilot",
        "objective/augments",
        "objectives",
        "augments",
    }
)


def section_can_claim_types(name: str) -> bool:
    """Pilot and objective slots are not type buckets."""
    return type_token(name).casefold() not in _RESERVED_SECTION_NAMES


def prepare_section_types(
    values: list[str],
    others: list[list[str]],
) -> tuple[list[str], str | None]:
    """
    Clean a section's type list.

    Returns the stored labels and a problem code, or None when the set
    is legal. ``repeated`` means one type was listed twice. ``taken``
    means another section already uses this exact set.
    """
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        token = type_token(str(raw))
        if token == "":
            continue
        key = type_key(token)
        if key in seen:
            return [], "repeated"
        seen.add(key)
        cleaned.append(token)

    if len(seen) == 0:
        return [], None

    wanted = "|".join(sorted(seen))
    for other in others:
        other_keys = {
            type_key(item)
            for item in other
            if type_token(str(item)) != ""
        }
        if len(other_keys) == 0:
            continue
        if "|".join(sorted(other_keys)) == wanted:
            return [], "taken"
    return cleaned, None
