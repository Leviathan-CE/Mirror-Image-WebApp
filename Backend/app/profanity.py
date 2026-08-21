"""
Profanity gate for user text that can appear in public surfaces.

Design notes (why backend matters):
- The browser can be bypassed; only API checks enforce the rule.
- Matching is word/phrase based after light leetspeak normalization so
  "classic" is not blocked by a bare "ass" substring rule.
- The blocklist is a starter set — extend PROFANE_TERMS as needed.
"""

from __future__ import annotations

import re
import unicodedata

from fastapi import HTTPException, status

# Whole words / multi-word phrases (lowercase). Keep this list intentional;
# short ambiguous tokens cause false positives.
PROFANE_TERMS: frozenset[str] = frozenset(
    {
        "asshole",
        "assholes",
        "bastard",
        "bastards",
        "bitch",
        "bitches",
        "bollocks",
        "bullshit",
        "cock",
        "cocks",
        "cunt",
        "cunts",
        "dick",
        "dicks",
        "dumbass",
        "fag",
        "faggot",
        "faggots",
        "fuck",
        "fucked",
        "fucker",
        "fuckers",
        "fucking",
        "motherfucker",
        "motherfuckers",
        "nigger",
        "niggers",
        "piss",
        "pussy",
        "shit",
        "shits",
        "shithead",
        "slut",
        "sluts",
        "twat",
        "wank",
        "wanker",
        "whore",
        "whores",
    }
)

_LEET = str.maketrans(
    {
        "@": "a",
        "4": "a",
        "8": "b",
        "(": "c",
        "3": "e",
        "1": "i",
        "!": "i",
        "0": "o",
        "$": "s",
        "5": "s",
        "7": "t",
    }
)

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def normalize_for_profanity(text: str) -> str:
    """Lowercase, strip accents, map common leetspeak, collapse separators."""
    folded = unicodedata.normalize("NFKD", text or "")
    ascii_ish = "".join(ch for ch in folded if not unicodedata.combining(ch))
    lowered = ascii_ish.lower().translate(_LEET)
    # "f.u.c.k" / "f u c k" → keep tokens for word checks AND a compacted form
    return lowered


def _tokens(normalized: str) -> list[str]:
    return [t for t in _NON_ALNUM.split(normalized) if t]


def _compact(normalized: str) -> str:
    return _NON_ALNUM.sub("", normalized)


def find_profanity(text: str | None) -> str | None:
    """
    Return the matched blocked term, or None if clean / empty.
    """
    if text is None:
        return None
    raw = str(text).strip()
    if not raw:
        return None

    normalized = normalize_for_profanity(raw)
    tokens = set(_tokens(normalized))
    compact = _compact(normalized)

    for term in PROFANE_TERMS:
        if " " in term:
            spaced = term.replace(" ", "")
            if term in normalized or spaced in compact:
                return term
            continue
        if term in tokens or term == compact:
            return term
        # Multi-token smash: "dumb ass" already covered if listed; also
        # catch smashed single terms inside compact only when term length ≥ 4
        # to reduce "ass"/"hell" false positives inside longer words.
        if len(term) >= 4 and term in compact:
            return term

    return None


def contains_profanity(text: str | None) -> bool:
    return find_profanity(text) is not None


def reject_if_profane(text: str | None, *, field: str = "text") -> None:
    """Raise HTTP 400 when public-facing text fails the filter."""
    hit = find_profanity(text)
    if hit is None:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="profanity_rejected",
        headers={"X-Profanity-Field": field},
    )
