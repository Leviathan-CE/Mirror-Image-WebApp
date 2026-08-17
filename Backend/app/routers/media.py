"""Signed image delivery for card art and deck covers.

Replaces the open `/thumbnails` StaticFiles mount: a request only succeeds with
a signature minted by an endpoint that already checked the caller may see the
image (see `app.media_urls`). Everything unauthorized answers 404 so the route
never confirms that a file exists.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.media_urls import (
    MEDIA_URL_PREFIX,
    media_content_type,
    resolve_media_file,
    verify_media_signature,
)

router = APIRouter(tags=["media"])

MEDIA_DIR = Path(__file__).resolve().parent.parent / "thumbnails"


@router.get(f"/{MEDIA_URL_PREFIX}/{{key:path}}")
def get_media(
    key: str,
    exp: int = Query(..., description="Signature expiry (epoch seconds)."),
    sig: str = Query(..., description="HMAC minted with the image path."),
    v: int | None = Query(
        default=None, description="Cache-buster from card_art_version; unused."
    ),
) -> FileResponse:
    """Serve a signed image. Bad, expired, or unknown → 404."""
    del v
    if not verify_media_signature(key, exp, sig):
        raise HTTPException(status_code=404, detail="media_not_found")

    file_path = resolve_media_file(MEDIA_DIR, key)
    if file_path is None:
        raise HTTPException(status_code=404, detail="media_not_found")

    return FileResponse(
        file_path,
        media_type=media_content_type(file_path),
        # Matches the previous mount: re-uploads keep the same key, and the
        # frontend's ?v= cache-buster is the only revalidation signal.
        headers={"Cache-Control": "no-store"},
    )
