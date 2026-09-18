"""Public coming-soon flag + admin toggle."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedTable

from app.db import get_connection
from app.security import get_current_admin_user_id
from app.site_settings import coming_soon_or_false, write_coming_soon

logger = logging.getLogger(__name__)

router = APIRouter(tags=["site"])


class ComingSoonStatus(BaseModel):
    coming_soon: bool


class ComingSoonPatch(BaseModel):
    coming_soon: bool


@router.get("/site/coming-soon", response_model=ComingSoonStatus)
def get_coming_soon():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                enabled = coming_soon_or_false(cur)
    except OperationalError as e:
        logger.warning("db error on coming-soon read: %s", e)
        return ComingSoonStatus(coming_soon=False)
    return ComingSoonStatus(coming_soon=enabled)


@router.patch("/admin/site/coming-soon", response_model=ComingSoonStatus)
def patch_coming_soon(
    body: ComingSoonPatch,
    _admin_id: int = Depends(get_current_admin_user_id),
):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                enabled = write_coming_soon(cur, body.coming_soon)
            conn.commit()
    except UndefinedTable as e:
        logger.warning("site_settings table missing: %s", e)
        raise HTTPException(
            status_code=503, detail="site_settings_schema_missing"
        ) from e
    except OperationalError as e:
        logger.warning("db error on coming-soon write: %s", e)
        raise HTTPException(status_code=503, detail="database_unavailable") from e
    return ComingSoonStatus(coming_soon=enabled)
