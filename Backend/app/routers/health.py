import logging

from fastapi import APIRouter, HTTPException
from psycopg2 import OperationalError

from app.db import _db_config, get_connection

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/health/db")
def health_db():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                row = cur.fetchone()
        if row is None or row[0] != 1:
            raise HTTPException(status_code=503, detail="database_unexpected")
        return {"status": "ok", "database": True}
    except OperationalError as e:
        cfg = _db_config()
        safe = {k: v for k, v in cfg.items() if k != "password"}
        safe["password_set"] = bool(cfg.get("password"))
        logger.warning("Postgres connection failed %s: %s", safe, e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
