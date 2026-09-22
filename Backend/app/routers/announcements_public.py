"""Public announcement board (published posts only)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedTable

from app.announcements import ANNOUNCEMENT_SELECT, public_payload, row_to_dict
from app.db import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/announcements", tags=["announcements"])


class AnnouncementCover(BaseModel):
    kind: str
    image_url: str | None = None
    youtube_id: str | None = None


class AnnouncementPublic(BaseModel):
    id: int
    slug: str
    title: str
    body_markdown: str
    status: str
    published_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    cover: AnnouncementCover
    images: dict[str, str]


def _iso(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _to_public(cur, row: tuple) -> AnnouncementPublic:
    post = row_to_dict(row)
    payload = public_payload(cur, post)
    return AnnouncementPublic(
        id=payload["id"],
        slug=payload["slug"],
        title=payload["title"],
        body_markdown=payload["body_markdown"],
        status=payload["status"],
        published_at=_iso(payload["published_at"]),
        created_at=_iso(payload["created_at"]),
        updated_at=_iso(payload["updated_at"]),
        cover=AnnouncementCover(**payload["cover"]),
        images=payload["images"],
    )


@router.get("", response_model=list[AnnouncementPublic])
def list_published_announcements():
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    ANNOUNCEMENT_SELECT
                    + """
                     WHERE a.status = 'published'
                     ORDER BY a.published_at DESC NULLS LAST, a.id DESC
                    """
                )
                rows = cur.fetchall()
                return [_to_public(cur, row) for row in rows]
    except UndefinedTable as e:
        logger.warning("announcements schema missing: %s", e)
        raise HTTPException(
            status_code=503, detail="announcements_schema_missing"
        ) from e
    except OperationalError as e:
        raise HTTPException(
            status_code=503, detail="database_unavailable"
        ) from e


@router.get("/{slug}", response_model=AnnouncementPublic)
def get_published_announcement(slug: str):
    cleaned = (slug or "").strip()
    if not cleaned:
        raise HTTPException(status_code=404, detail="announcement_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    ANNOUNCEMENT_SELECT
                    + """
                     WHERE a.slug = %(slug)s AND a.status = 'published'
                    """,
                    {"slug": cleaned},
                )
                row = cur.fetchone()
                if row is None:
                    raise HTTPException(
                        status_code=404, detail="announcement_not_found"
                    )
                return _to_public(cur, row)
    except HTTPException:
        raise
    except UndefinedTable as e:
        raise HTTPException(
            status_code=503, detail="announcements_schema_missing"
        ) from e
    except OperationalError as e:
        raise HTTPException(
            status_code=503, detail="database_unavailable"
        ) from e
