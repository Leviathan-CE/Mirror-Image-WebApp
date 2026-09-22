"""Staff announcement CRUD + reusable media library."""

from __future__ import annotations

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from psycopg2 import OperationalError
from psycopg2.errors import UndefinedTable

from app.announcement_sanitize import (
    MAX_IMAGE_BYTES,
    sanitize_announcement_markdown,
    sanitize_title,
    sniff_image,
)
from app.announcements import (
    ANNOUNCEMENT_SELECT,
    LIBRARY_DIR,
    apply_cover_fields,
    public_payload,
    row_to_dict,
    unique_slug,
)
from app.db import get_connection
from app.media_urls import signed_media_path
from app.security import get_current_staff_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin-announcements"])

CoverKind = Literal["image", "youtube", "card"]
PostStatus = Literal["draft", "published"]
CardFace = Literal["art", "thumb"]


class AnnouncementCover(BaseModel):
    kind: str
    image_url: str | None = None
    youtube_id: str | None = None


class AnnouncementOut(BaseModel):
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
    cover_kind: str
    cover_media_id: int | None = None
    cover_card_id: int | None = None
    cover_card_face: str | None = None
    cover_youtube_id: str | None = None


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    body_markdown: str = ""
    status: PostStatus = "draft"
    cover_kind: CoverKind | None = None
    cover_media_id: int | None = None
    cover_card_id: int | None = None
    cover_card_face: CardFace | None = None
    cover_youtube: str | None = None


class AnnouncementPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    body_markdown: str | None = None
    status: PostStatus | None = None
    cover_kind: CoverKind | None = None
    cover_media_id: int | None = None
    cover_card_id: int | None = None
    cover_card_face: CardFace | None = None
    cover_youtube: str | None = None


class MediaItem(BaseModel):
    id: int
    label: str
    byte_size: int
    url: str | None = None


def _iso(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _to_out(cur, row: tuple) -> AnnouncementOut:
    post = row_to_dict(row)
    payload = public_payload(cur, post)
    return AnnouncementOut(
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
        cover_kind=post["cover_kind"],
        cover_media_id=post["cover_media_id"],
        cover_card_id=post["cover_card_id"],
        cover_card_face=post["cover_card_face"],
        cover_youtube_id=post["cover_youtube_id"],
    )


def _db_error(exc: Exception) -> HTTPException:
    if isinstance(exc, UndefinedTable):
        return HTTPException(
            status_code=503, detail="announcements_schema_missing"
        )
    return HTTPException(status_code=503, detail="database_unavailable")


def _cover_or_empty(cur, body: AnnouncementCreate | AnnouncementPatch) -> dict:
    if (
        body.cover_kind is None
        and body.cover_media_id is None
        and body.cover_card_id is None
        and not (body.cover_youtube or "").strip()
    ):
        return {
            "cover_kind": "image",
            "cover_media_id": None,
            "cover_card_id": None,
            "cover_card_face": None,
            "cover_youtube_id": None,
        }
    try:
        return apply_cover_fields(
            cur,
            cover_kind=body.cover_kind,
            cover_media_id=body.cover_media_id,
            cover_card_id=body.cover_card_id,
            cover_card_face=body.cover_card_face,
            cover_youtube=body.cover_youtube,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/announcements", response_model=list[AnnouncementOut])
def list_admin_announcements(
    _staff_id: int = Depends(get_current_staff_user_id),
):
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    ANNOUNCEMENT_SELECT
                    + " ORDER BY a.updated_at DESC, a.id DESC"
                )
                return [_to_out(cur, row) for row in cur.fetchall()]
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e


@router.post(
    "/announcements",
    response_model=AnnouncementOut,
    status_code=201,
)
def create_announcement(
    body: AnnouncementCreate,
    staff_id: int = Depends(get_current_staff_user_id),
):
    title = sanitize_title(body.title)
    if not title:
        raise HTTPException(status_code=400, detail="title_required")
    markdown = sanitize_announcement_markdown(body.body_markdown)
    status = body.status
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                slug = unique_slug(cur, title)
                cover = _cover_or_empty(cur, body)
                cur.execute(
                    """
                    INSERT INTO announcements (
                        slug, title, body_markdown, status,
                        cover_kind, cover_media_id, cover_card_id,
                        cover_card_face, cover_youtube_id,
                        published_at, created_by, updated_by
                    )
                    VALUES (
                        %(slug)s, %(title)s, %(body)s, %(status)s,
                        %(cover_kind)s, %(cover_media_id)s, %(cover_card_id)s,
                        %(cover_card_face)s, %(cover_youtube_id)s,
                        CASE WHEN %(status)s = 'published' THEN NOW() ELSE NULL END,
                        %(staff_id)s, %(staff_id)s
                    )
                    RETURNING id
                    """,
                    {
                        "slug": slug,
                        "title": title,
                        "body": markdown,
                        "status": status,
                        **cover,
                        "staff_id": staff_id,
                    },
                )
                new_id = int(cur.fetchone()[0])
                cur.execute(
                    ANNOUNCEMENT_SELECT + " WHERE a.id = %(id)s",
                    {"id": new_id},
                )
                row = cur.fetchone()
                result = _to_out(cur, row)
            conn.commit()
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e
    return result


@router.patch("/announcements/{announcement_id}", response_model=AnnouncementOut)
def patch_announcement(
    announcement_id: int,
    body: AnnouncementPatch,
    staff_id: int = Depends(get_current_staff_user_id),
):
    if announcement_id <= 0:
        raise HTTPException(status_code=404, detail="announcement_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    ANNOUNCEMENT_SELECT + " WHERE a.id = %(id)s",
                    {"id": announcement_id},
                )
                existing = cur.fetchone()
                if existing is None:
                    raise HTTPException(
                        status_code=404, detail="announcement_not_found"
                    )
                post = row_to_dict(existing)
                title = (
                    sanitize_title(body.title)
                    if body.title is not None
                    else post["title"]
                )
                if not title:
                    raise HTTPException(status_code=400, detail="title_required")
                markdown = (
                    sanitize_announcement_markdown(body.body_markdown)
                    if body.body_markdown is not None
                    else sanitize_announcement_markdown(post["body_markdown"])
                )
                status = body.status or post["status"]
                slug = (
                    unique_slug(cur, title, exclude_id=announcement_id)
                    if body.title is not None
                    else post["slug"]
                )
                if (
                    body.cover_kind is not None
                    or body.cover_media_id is not None
                    or body.cover_card_id is not None
                    or body.cover_youtube is not None
                ):
                    cover = _cover_or_empty(cur, body)
                else:
                    cover = {
                        "cover_kind": post["cover_kind"],
                        "cover_media_id": post["cover_media_id"],
                        "cover_card_id": post["cover_card_id"],
                        "cover_card_face": post["cover_card_face"],
                        "cover_youtube_id": post["cover_youtube_id"],
                    }
                cur.execute(
                    """
                    UPDATE announcements
                       SET slug = %(slug)s,
                           title = %(title)s,
                           body_markdown = %(body)s,
                           status = %(status)s,
                           cover_kind = %(cover_kind)s,
                           cover_media_id = %(cover_media_id)s,
                           cover_card_id = %(cover_card_id)s,
                           cover_card_face = %(cover_card_face)s,
                           cover_youtube_id = %(cover_youtube_id)s,
                           published_at = CASE
                             WHEN %(status)s = 'published'
                              AND published_at IS NULL THEN NOW()
                             WHEN %(status)s = 'draft' THEN published_at
                             ELSE published_at
                           END,
                           updated_at = NOW(),
                           updated_by = %(staff_id)s
                     WHERE id = %(id)s
                    """,
                    {
                        "id": announcement_id,
                        "slug": slug,
                        "title": title,
                        "body": markdown,
                        "status": status,
                        **cover,
                        "staff_id": staff_id,
                    },
                )
                cur.execute(
                    ANNOUNCEMENT_SELECT + " WHERE a.id = %(id)s",
                    {"id": announcement_id},
                )
                row = cur.fetchone()
                result = _to_out(cur, row)
            conn.commit()
    except HTTPException:
        raise
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e
    return result


@router.delete("/announcements/{announcement_id}", status_code=204)
def delete_announcement(
    announcement_id: int,
    _staff_id: int = Depends(get_current_staff_user_id),
):
    if announcement_id <= 0:
        raise HTTPException(status_code=404, detail="announcement_not_found")
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM announcements WHERE id = %(id)s",
                    {"id": announcement_id},
                )
                if cur.rowcount == 0:
                    raise HTTPException(
                        status_code=404, detail="announcement_not_found"
                    )
            conn.commit()
    except HTTPException:
        raise
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e


@router.get("/announcement-media", response_model=list[MediaItem])
def list_announcement_media(
    q: str = Query(default="", max_length=80),
    _staff_id: int = Depends(get_current_staff_user_id),
):
    needle = q.strip()
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                if needle:
                    cur.execute(
                        """
                        SELECT id, label, byte_size, storage_key
                          FROM announcement_media
                         WHERE label ILIKE %(q)s
                         ORDER BY created_at DESC
                         LIMIT 40
                        """,
                        {"q": f"%{needle}%"},
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, label, byte_size, storage_key
                          FROM announcement_media
                         ORDER BY created_at DESC
                         LIMIT 40
                        """
                    )
                items = []
                for row in cur.fetchall():
                    items.append(
                        MediaItem(
                            id=int(row[0]),
                            label=row[1] or "",
                            byte_size=int(row[2]),
                            url=signed_media_path(row[3]),
                        )
                    )
                return items
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e


@router.post(
    "/announcement-media",
    response_model=MediaItem,
    status_code=201,
)
async def upload_announcement_media(
    file: UploadFile = File(...),
    staff_id: int = Depends(get_current_staff_user_id),
):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty_image")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="image_too_large")
    sniffed = sniff_image(data)
    if sniffed is None:
        raise HTTPException(status_code=400, detail="unsupported_image_type")
    ext, _mime = sniffed
    label = sanitize_title(file.filename or "image") or "image"

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO announcement_media (storage_key, label, byte_size, created_by)
                    VALUES (%(pending)s, %(label)s, %(size)s, %(staff_id)s)
                    RETURNING id
                    """,
                    {
                        "pending": f"pending/{uuid.uuid4().hex}",
                        "label": label,
                        "size": len(data),
                        "staff_id": staff_id,
                    },
                )
                media_id = int(cur.fetchone()[0])
                LIBRARY_DIR.mkdir(parents=True, exist_ok=True)
                file_name = f"{media_id}{ext}"
                path = LIBRARY_DIR / file_name
                path.write_bytes(data)
                storage_key = f"announcements/library/{file_name}"
                cur.execute(
                    """
                    UPDATE announcement_media
                       SET storage_key = %(key)s
                     WHERE id = %(id)s
                    """,
                    {"key": storage_key, "id": media_id},
                )
            conn.commit()
    except OSError as e:
        logger.warning("announcement media write failed: %s", e)
        raise HTTPException(status_code=500, detail="image_write_failed") from e
    except (UndefinedTable, OperationalError) as e:
        raise _db_error(e) from e

    return MediaItem(
        id=media_id,
        label=label,
        byte_size=len(data),
        url=signed_media_path(storage_key),
    )
