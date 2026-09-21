"""Site-wide admin flags. Keys live in ``site_settings``."""

from __future__ import annotations

from psycopg2.errors import UndefinedTable

COMING_SOON_KEY = "coming_soon"
TRUE_VALUES = frozenset({"true", "1", "yes", "on"})


def parse_bool_setting(raw: object | None) -> bool:
    if raw is None:
        return False
    return str(raw).strip().lower() in TRUE_VALUES


def read_coming_soon(cur) -> bool:
    cur.execute(
        "SELECT value FROM site_settings WHERE key = %(key)s",
        {"key": COMING_SOON_KEY},
    )
    row = cur.fetchone()
    if row is None:
        return False
    return parse_bool_setting(row[0])


def write_coming_soon(cur, enabled: bool) -> bool:
    value = "true" if enabled else "false"
    cur.execute(
        """
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (%(key)s, %(value)s, NOW())
        ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_at = NOW()
        """,
        {"key": COMING_SOON_KEY, "value": value},
    )
    return enabled


def coming_soon_or_false(cur) -> bool:
    """Missing table / row must not lock the public site."""
    try:
        return read_coming_soon(cur)
    except UndefinedTable:
        return False
