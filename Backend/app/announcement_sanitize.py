"""Allowlist sanitizer for announcement markdown (never execute HTML or SQL)."""

from __future__ import annotations

import re
from urllib.parse import parse_qs, urlparse

MAX_IMAGE_BYTES = 1_048_576
MAX_BODY_CHARS = 40_000
MAX_TITLE_CHARS = 160

_HTML_TAG_RE = re.compile(r"<[^>]*>", re.IGNORECASE)
_FENCE_RE = re.compile(r"```[\s\S]*?```")
_INLINE_CODE_RE = re.compile(r"`[^`]*`")
_IMAGE_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
_LINK_RE = re.compile(r"(?<!!)\[([^\]]+)\]\(([^)]+)\)")
_NULL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
_IMAGE_REF_RE = re.compile(r"^(media|card-art|card-thumb):(\d+)$")
_YOUTUBE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_HOSTS = frozenset(
    {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "youtu.be",
        "www.youtu.be",
        "youtube-nocookie.com",
        "www.youtube-nocookie.com",
    }
)
_BAD_SCHEMES = ("javascript:", "data:", "vbscript:", "file:")


def sniff_image(data: bytes) -> tuple[str, str] | None:
    """Return (extension, mime) from magic bytes, or None."""
    if not data:
        return None
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


def parse_image_ref(href: str) -> tuple[str, int] | None:
    raw = (href or "").strip()
    match = _IMAGE_REF_RE.fullmatch(raw)
    if match is None:
        return None
    return match.group(1), int(match.group(2))


def parse_youtube_id(value: str | None) -> str | None:
    raw = (value or "").strip()
    if not raw:
        return None
    if _YOUTUBE_ID_RE.fullmatch(raw):
        return raw

    lowered = raw.lower()
    if lowered.startswith(_BAD_SCHEMES):
        return None

    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host not in _YOUTUBE_HOSTS:
        return None
    if parsed.scheme and parsed.scheme not in {"http", "https"}:
        return None

    if host.endswith("youtu.be"):
        candidate = parsed.path.lstrip("/").split("/", 1)[0]
        return candidate if _YOUTUBE_ID_RE.fullmatch(candidate) else None

    parts = [p for p in parsed.path.split("/") if p]
    if parts and parts[0] in {"embed", "shorts", "live"} and len(parts) > 1:
        candidate = parts[1]
        return candidate if _YOUTUBE_ID_RE.fullmatch(candidate) else None

    query = parse_qs(parsed.query)
    vids = query.get("v") or []
    if vids and _YOUTUBE_ID_RE.fullmatch(vids[0]):
        return vids[0]
    return None


def extract_image_refs(markdown: str) -> list[tuple[str, int]]:
    refs: list[tuple[str, int]] = []
    seen: set[tuple[str, int]] = set()
    for match in _IMAGE_RE.finditer(markdown or ""):
        parsed = parse_image_ref(match.group(2))
        if parsed is None or parsed in seen:
            continue
        seen.add(parsed)
        refs.append(parsed)
    return refs


def sanitize_announcement_markdown(text: str | None) -> str:
    """
    Keep markdown structure. Drop HTML, code, and non-allowlisted images/URLs.
    """
    if not text:
        return ""
    cleaned = _NULL_RE.sub("", text)
    cleaned = _HTML_TAG_RE.sub("", cleaned)
    cleaned = _FENCE_RE.sub("", cleaned)
    cleaned = _INLINE_CODE_RE.sub("", cleaned)
    cleaned = _IMAGE_RE.sub(_keep_allowed_image, cleaned)
    cleaned = _LINK_RE.sub(_keep_allowed_link, cleaned)
    if len(cleaned) > MAX_BODY_CHARS:
        return cleaned[:MAX_BODY_CHARS]
    return cleaned


def sanitize_title(title: str | None) -> str:
    raw = _NULL_RE.sub("", (title or "").strip())
    raw = _HTML_TAG_RE.sub("", raw)
    if len(raw) > MAX_TITLE_CHARS:
        return raw[:MAX_TITLE_CHARS]
    return raw


def slugify_title(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return (slug[:80] or "post").rstrip("-")


def _keep_allowed_image(match: re.Match[str]) -> str:
    alt = match.group(1)
    href = match.group(2).strip()
    if parse_image_ref(href) is None:
        return ""
    return f"![{alt}]({href})"


def _keep_allowed_link(match: re.Match[str]) -> str:
    label = match.group(1)
    href = match.group(2).strip()
    lowered = href.lower()
    if lowered.startswith(_BAD_SCHEMES):
        return label
    if parse_youtube_id(href):
        return f"[{label}]({href})"
    parsed = urlparse(href)
    if parsed.scheme in {"http", "https"} and parsed.hostname:
        return f"[{label}]({href})"
    return label
