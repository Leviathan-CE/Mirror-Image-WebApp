import os
from contextlib import contextmanager
from pathlib import Path

import psycopg2
from dotenv import load_dotenv

# override=True: .env wins over inherited shell/IDE vars (e.g. DB_PORT=5432 breaks Docker on 5433).
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)


def _strip_env(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip().strip('"')


def _db_config() -> dict[str, str]:
    port_raw = os.environ.get("DB_PORT") or os.environ.get("PORT") or "5432"
    password = _strip_env(
        os.environ.get("SQL_PSWRD") or os.environ.get("DB_PASSWORD")
    )
    return {
        "host": _strip_env(os.environ.get("DB_HOST")) or "127.0.0.1",
        "port": str(port_raw).strip(),
        "dbname": _strip_env(os.environ.get("POSTGRES_DB"))
        or _strip_env(os.environ.get("DB_NAME"))
        or "mirror_image",
        "user": _strip_env(os.environ.get("POSTGRES_USER"))
        or _strip_env(os.environ.get("DB_USER"))
        or "postgres",
        "password": password,
    }


@contextmanager
def get_connection():
    conn = psycopg2.connect(**_db_config())
    try:
        yield conn
    finally:
        conn.close()
