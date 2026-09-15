"""
Central app settings from environment.

Frontend URLs (CORS + Stripe return links) live here only — do not hardcode
origins in routers. Set these in `.env` / compose:

  FRONTEND_URL=https://your.app          # primary public site URL
  FRONTEND_ORIGINS=https://your.app,https://www.your.app   # optional allowlist

If FRONTEND_ORIGINS is omitted, FRONTEND_URL is used alone (plus local-dev
defaults when APP_ENV is development/dev/local).
"""

from __future__ import annotations

import os
from urllib.parse import urlparse


def app_env() -> str:
    return (os.environ.get("APP_ENV") or "development").strip().lower()


def is_dev() -> bool:
    return app_env() in {"development", "dev", "local", ""}


def _strip_env_value(raw: str) -> str:
    """Trim and drop inline `#` comments (common .env foot-gun)."""
    return raw.split("#", 1)[0].strip().rstrip("/")


def frontend_url() -> str:
    """Primary public frontend origin (no trailing slash)."""
    return (
        _strip_env_value(os.environ.get("FRONTEND_URL") or "")
        or "http://127.0.0.1:3000"
    )


_LOCAL_DEV_ORIGINS = (
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def _loopback_twins(origin: str) -> set[str]:
    """
    localhost and 127.0.0.1 are different browser origins (separate localStorage).
    Stripe must send the user back to the *same* host they left from.
    """
    parsed = urlparse(origin)
    host = (parsed.hostname or "").lower()
    if host not in {"localhost", "127.0.0.1"}:
        return {origin}
    twin = "127.0.0.1" if host == "localhost" else "localhost"
    port = f":{parsed.port}" if parsed.port else ""
    return {
        origin,
        f"{parsed.scheme}://{twin}{port}",
    }


def frontend_origins() -> list[str]:
    """
    Full allowlist for CORS and Stripe success/cancel/return redirects.

    Prefer FRONTEND_ORIGINS (comma-separated). Otherwise start from FRONTEND_URL
    and, in development, include the usual local Vite/docker hostnames.
    """
    origins: list[str] = []
    raw_full = (os.environ.get("FRONTEND_ORIGINS") or "").strip()

    if raw_full:
        for part in raw_full.split(","):
            origin = _strip_env_value(part)
            if origin and origin not in origins:
                origins.append(origin)
    else:
        primary = frontend_url()
        if primary:
            origins.append(primary)
        if is_dev():
            for origin in _LOCAL_DEV_ORIGINS:
                if origin not in origins:
                    origins.append(origin)

    # Always include loopback twins of any loopback entry so localhost↔127.0.0.1
    # both CORS and Stripe returns work.
    expanded: list[str] = []
    for origin in origins:
        for twin in sorted(_loopback_twins(origin)):
            if twin not in expanded:
                expanded.append(twin)
    return expanded


def resolve_frontend_origin(requested: str | None = None) -> str:
    """
    Prefer the browser's current origin when it is on the allowlist
    (including localhost↔127.0.0.1 twins). Falls back to FRONTEND_URL.
    """
    allowed = set(frontend_origins())
    candidate = _strip_env_value(requested or "")
    if candidate and candidate in allowed:
        return candidate
    # Last chance: accept exact loopback twin match even if only one was listed.
    if candidate:
        for twin in _loopback_twins(candidate):
            if twin in allowed:
                # Prefer the browser's host so localStorage/session survive.
                return candidate
    return frontend_url()
