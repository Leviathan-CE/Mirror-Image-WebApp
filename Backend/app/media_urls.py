"""Signed, expiring URLs for card art and deck covers.

`/thumbnails` used to be an open StaticFiles mount. Because a card's art path is
derived from its set and card name — and redaction *keeps* the card name — the
art of an unreleased card could be fetched by anyone who had merely seen the
name in a deck list. Nothing about the "secret" side of preview / unpublished
cards was actually enforced.

Images now come only from `/media/{key}`, and a request needs a signature that
the API mints where it has already decided the caller may see that image. A
classified card returns no path at all (see `card_publish`), so there is no
signature to hand out. Same for a deck cover: the signature is minted next to
the readability check.

The signature is a capability over one storage key, never an identity, so it is
safe to put in an `<img src>`. `exp` snaps to a window boundary so the same
image keeps a stable URL between refetches while still ageing out.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from pathlib import Path
from urllib.parse import quote

from app.security import signing_secret

# URL space that replaces the old `/thumbnails` mount.
MEDIA_URL_PREFIX = "media"

# Signatures age out on a boundary, so an image keeps one URL for one to two
# windows. Long enough that a playtest session never outlives the art it was
# dealt (card URLs are captured into session state at deal time), short enough
# that a deliberately shared URL stops working the same day.
MEDIA_WINDOW_SEC = 6 * 60 * 60

# 128 bits of HMAC is ample for a short-lived capability and keeps URLs short.
_SIG_BYTES = 16
_SIG_CONTEXT = "media-url-v1"

MEDIA_CONTENT_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def storage_key(path: str) -> str:
    """
    Normalize a stored image path to the key used in signatures and URLs.

    Card art is stored as `thumbnails/<set>/<file>` and deck covers as
    `decks/<id>/<file>`; both are relative to the thumbnails directory.
    """
    key = path.replace("\\", "/").lstrip("/")
    if key.lower().startswith("thumbnails/"):
        key = key[len("thumbnails/") :]
    return key


def media_expiry(now: float | None = None) -> int:
    """Next window boundary — between one and two windows from now."""
    seconds = int(now if now is not None else time.time())
    return (seconds // MEDIA_WINDOW_SEC + 2) * MEDIA_WINDOW_SEC


def sign_media_key(key: str, exp: int) -> str:
    digest = hmac.new(
        signing_secret().encode("utf-8"),
        f"{_SIG_CONTEXT}:{key}:{exp}".encode("utf-8"),
        hashlib.sha256,
    ).digest()[:_SIG_BYTES]
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def signed_media_path(path: str | None, now: float | None = None) -> str | None:
    """
    Relative signed URL for a stored image path, or None when there is no image.

    Callers must only reach this for images the viewer is allowed to see — the
    signature is the permission.
    """
    if not path:
        return None
    key = storage_key(path)
    if not key:
        return None
    exp = media_expiry(now)
    return (
        f"{MEDIA_URL_PREFIX}/{quote(key, safe='/')}"
        f"?exp={exp}&sig={sign_media_key(key, exp)}"
    )


def verify_media_signature(
    key: str, exp: int, sig: str, now: float | None = None
) -> bool:
    seconds = int(now if now is not None else time.time())
    if exp <= seconds:
        return False
    return hmac.compare_digest(sign_media_key(key, exp), sig)


def resolve_media_file(base_dir: Path, key: str) -> Path | None:
    """
    Existing file for ``key`` inside ``base_dir``, or None.

    Signed or not, a key must never escape the media directory.
    """
    if not key or ".." in key.replace("\\", "/").split("/"):
        return None
    try:
        candidate = (base_dir / key).resolve()
        base = base_dir.resolve()
    except OSError:
        return None
    if not candidate.is_relative_to(base):
        return None
    if not candidate.is_file():
        return None
    return candidate


def media_content_type(path: Path) -> str:
    return MEDIA_CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
