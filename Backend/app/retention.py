"""Short retention jobs that are safe to run often."""

from __future__ import annotations

from psycopg2.extensions import cursor as PgCursor


def delete_expired_print_grants(cur: PgCursor) -> int:
    """Remove paid print unlocks whose window has closed."""
    cur.execute(
        """
        DELETE FROM print_download_grants
         WHERE expires_at < NOW()
        """
    )
    return int(cur.rowcount or 0)
