"""Validated account UI preferences (decks + card library)."""

from __future__ import annotations

from typing import Any

from psycopg2.extras import Json

from app.deck_defaults import DEFAULT_DECK_CATEGORY_NAMES, RESERVED_CATEGORY_NAMES
from app.profanity import contains_profanity

DECK_VIEWS = frozenset({"cards", "list"})
DECK_SORTS = frozenset({"type", "invoke", "name"})
LIBRARY_SORTS = frozenset(
    {"name", "name_desc", "invoke", "invoke_desc", "relevance"}
)
LIBRARY_PAGE_SIZES = frozenset({50, 100, 150, 200})

BROWSE_WIDTH_MIN = 280
BROWSE_WIDTH_MAX = 2400
BROWSE_WIDTH_DEFAULT = 352
PREVIEW_PX_MIN = 72
PREVIEW_PX_MAX = 200
PREVIEW_PX_DEFAULT = 112

SECTION_NAME_MAX = 60
SECTION_COUNT_MIN = 1
SECTION_COUNT_MAX = 12
DEFAULT_START_SECTIONS = list(DEFAULT_DECK_CATEGORY_NAMES)

DEFAULT_PREFERENCES: dict[str, Any] = {
    "deck_view": "cards",
    "deck_sort": "type",
    "deck_browse_width_px": BROWSE_WIDTH_DEFAULT,
    "library_sort": "name",
    "library_page_size": 50,
    "library_preview_px": PREVIEW_PX_DEFAULT,
    "deck_start_sections": list(DEFAULT_START_SECTIONS),
}


def _clamp_int(value: Any, lo: int, hi: int, default: int) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, number))


def _normalize_start_sections(raw: Any) -> list[str]:
    if not isinstance(raw, list):
        return list(DEFAULT_START_SECTIONS)
    out: list[str] = []
    seen: set[str] = set()
    for item in raw:
        name = str(item).strip()[:SECTION_NAME_MAX]
        if not name or contains_profanity(name):
            continue
        key = name.lower()
        if key in RESERVED_CATEGORY_NAMES or key in seen:
            continue
        seen.add(key)
        out.append(name)
        if len(out) >= SECTION_COUNT_MAX:
            break
    if len(out) < SECTION_COUNT_MIN:
        return list(DEFAULT_START_SECTIONS)
    return out


def normalize_user_preferences(raw: Any) -> dict[str, Any]:
    """Allowlisted keys only; missing / invalid fields fall back to defaults."""
    data = raw if isinstance(raw, dict) else {}
    view = str(data.get("deck_view") or "").strip().lower()
    sort = str(data.get("deck_sort") or "").strip().lower()
    lib_sort = str(data.get("library_sort") or "").strip().lower()
    page = data.get("library_page_size")
    try:
        page_n = int(page) if page is not None else 50
    except (TypeError, ValueError):
        page_n = 50
    return {
        "deck_view": view if view in DECK_VIEWS else "cards",
        "deck_sort": sort if sort in DECK_SORTS else "type",
        "deck_browse_width_px": _clamp_int(
            data.get("deck_browse_width_px"),
            BROWSE_WIDTH_MIN,
            BROWSE_WIDTH_MAX,
            BROWSE_WIDTH_DEFAULT,
        ),
        "library_sort": lib_sort if lib_sort in LIBRARY_SORTS else "name",
        "library_page_size": page_n if page_n in LIBRARY_PAGE_SIZES else 50,
        "library_preview_px": _clamp_int(
            data.get("library_preview_px"),
            PREVIEW_PX_MIN,
            PREVIEW_PX_MAX,
            PREVIEW_PX_DEFAULT,
        ),
        "deck_start_sections": _normalize_start_sections(
            data.get("deck_start_sections")
        ),
    }


def preferences_are_unset(raw: Any) -> bool:
    return not isinstance(raw, dict) or len(raw) == 0


def merge_preference_patch(current: Any, patch: dict[str, Any] | None) -> dict[str, Any]:
    base = normalize_user_preferences(current)
    if not patch:
        return base
    merged = {**base, **{k: v for k, v in patch.items() if v is not None}}
    return normalize_user_preferences(merged)


def fetch_user_preferences_raw(cur, user_id: int) -> dict[str, Any]:
    """Stored JSON as-is ({} until the user has saved prefs)."""
    cur.execute(
        """
        SELECT COALESCE(preferences, '{}'::jsonb)
          FROM users
         WHERE id = %(user_id)s
        """,
        {"user_id": user_id},
    )
    row = cur.fetchone()
    raw = row[0] if row else {}
    return raw if isinstance(raw, dict) else {}


def fetch_user_preferences(cur, user_id: int) -> dict[str, Any]:
    return normalize_user_preferences(fetch_user_preferences_raw(cur, user_id))


def save_user_preferences(cur, user_id: int, prefs: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_user_preferences(prefs)
    cur.execute(
        """
        UPDATE users
           SET preferences = %(prefs)s::jsonb,
               updated_at = NOW()
         WHERE id = %(user_id)s
     RETURNING COALESCE(preferences, '{}'::jsonb)
        """,
        {"prefs": Json(normalized), "user_id": user_id},
    )
    row = cur.fetchone()
    return normalize_user_preferences(row[0] if row else normalized)
