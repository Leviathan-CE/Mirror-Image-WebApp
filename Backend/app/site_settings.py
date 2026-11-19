"""Site-wide admin flags. Keys live in ``site_settings``."""

from __future__ import annotations

from psycopg2.errors import UndefinedTable

COMING_SOON_KEY = "coming_soon"
PREVIEWS_FOR_LOGGED_IN_KEY = "previews_for_logged_in"
TRUE_VALUES = frozenset({"true", "1", "yes", "on"})


def parse_bool_setting(raw: object | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in TRUE_VALUES


def _read_bool_key(cur, key: str) -> bool:
    cur.execute(
        "SELECT value FROM site_settings WHERE key = %(key)s",
        {"key": key},
    )
    row = cur.fetchone()
    if row is None:
        return False
    return parse_bool_setting(row[0])


def _write_bool_key(cur, key: str, enabled: bool) -> bool:
    value = "true" if enabled else "false"
    cur.execute(
        """
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (%(key)s, %(value)s, NOW())
        ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = NOW()
        """,
        {"key": key, "value": value},
    )
    return enabled


def read_coming_soon(cur) -> bool:
    return _read_bool_key(cur, COMING_SOON_KEY)


def write_coming_soon(cur, enabled: bool) -> bool:
    return _write_bool_key(cur, COMING_SOON_KEY, enabled)


def coming_soon_or_false(cur) -> bool:
    """Missing table / row must not lock the public site."""
    try:
        return read_coming_soon(cur)
    except UndefinedTable:
        return False


def read_previews_for_logged_in(cur) -> bool:
    return _read_bool_key(cur, PREVIEWS_FOR_LOGGED_IN_KEY)


def write_previews_for_logged_in(cur, enabled: bool) -> bool:
    return _write_bool_key(cur, PREVIEWS_FOR_LOGGED_IN_KEY, enabled)


def previews_for_logged_in_or_false(cur) -> bool:
    """Missing table / row keeps preview subscriber-gated."""
    try:
        return read_previews_for_logged_in(cur)
    except UndefinedTable:
        return False
