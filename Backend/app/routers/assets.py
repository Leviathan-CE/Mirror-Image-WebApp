"""Auth-gated URLs for non-card system images (e.g. card back).

`<img src>` cannot send a Bearer token, so callers receive a short-lived signed
`/media/...` path — the same capability model as card art.

The premium system card back is staff-only. Regular users use the public free
back served from the SPA (`/images/card_back_free.png`).
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from app.media_urls import signed_media_path
from app.security import get_current_staff_user_id

router = APIRouter(prefix="/assets", tags=["assets"])

# Tracked in git (unlike the gitignored thumbnails volume).
SYSTEM_MEDIA_DIR = Path(__file__).resolve().parent.parent / "system_media"
CARD_BACK_FILE = "card_back.png"
CARD_BACK_KEY = f"system/{CARD_BACK_FILE}"


@router.get("/card-back")
def get_card_back_url(
    _staff_id: int = Depends(get_current_staff_user_id),
) -> dict[str, str]:
    """Signed premium card-back URL. Requires staff (admin/developer)."""
    file_path = SYSTEM_MEDIA_DIR / CARD_BACK_FILE
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="media_not_found")

    path = signed_media_path(CARD_BACK_KEY)
    if path is None:
        raise HTTPException(status_code=404, detail="media_not_found")
    return {"card_back_path": path}
