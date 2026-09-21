import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# Keep environment variables from Docker/host as source of truth.
# Use the repository root .env as the single shared config source.
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


def _strip_env(value: str | None) -> str:
    """
    Args:
        value (str | None): envirmeont varable

    Returns:
        str: stripped " " around env var
    """
    if value is None:
        return ""
    return value.strip().strip('"')


def _first_env(*names: str, default: str = "") -> str:
    """First non-empty stripped env value among `names`, else `default`."""
    for name in names:
        value = _strip_env(os.environ.get(name))
        if value:
            return value
    return default


def _db_config() -> dict[str, str]:
    """
    Connection fields from the repo-root `.env`.

    Set POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / POSTGRES_PORT once.
    DB_* names still work as aliases. DB_HOST / DB_PORT win over POSTGRES_PORT
    so the API container can use host `db` port 5432 while the host publish
    port stays 5433.
    """
    host = _first_env("DB_HOST", default="127.0.0.1")
    port = _first_env("DB_PORT", "POSTGRES_PORT", default="5432")

    return {
        "host": host,
        "port": port,
        "dbname": _first_env("POSTGRES_DB", "DB_NAME", default="mirror_image"),
        "user": _first_env("POSTGRES_USER", "DB_USER", default="postgres"),
        "password": _first_env(
            "POSTGRES_PASSWORD", "DB_PASSWORD", "SQL_PSWRD"
        ),
    }


@contextmanager
def get_connection():
    conn = psycopg2.connect(**_db_config())
    try:
        yield conn
    finally:
        conn.close()
