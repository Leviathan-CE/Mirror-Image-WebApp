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


def app_env() -> str:
    return (os.environ.get("APP_ENV") or "development").strip().lower()


def is_dev() -> bool:
    return app_env() in {"development", "dev", "local", ""}


def frontend_url() -> str:
    """Primary public frontend origin (no trailing slash)."""
    return (
        (os.environ.get("FRONTEND_URL") or "").strip().rstrip("/")
        or "http://127.0.0.1:3000"
    )


_LOCAL_DEV_ORIGINS = (
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def frontend_origins() -> list[str]:
    """
    Full allowlist for CORS and Stripe success/cancel/return redirects.

    Prefer FRONTEND_ORIGINS (comma-separated). Otherwise start from FRONTEND_URL
    and, in development, include the usual local Vite/docker hostnames.
    """
    raw = (os.environ.get("FRONTEND_ORIGINS") or "").strip()
    origins: list[str] = []

    if raw:
        for part in raw.split(","):
            origin = part.strip().rstrip("/")
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

    return origins


def resolve_frontend_origin(requested: str | None = None) -> str:
    """
    Prefer the browser's current origin when it is on the allowlist.
    Falls back to FRONTEND_URL.
    """
    allowed = set(frontend_origins())
    candidate = (requested or "").strip().rstrip("/")
    if candidate and candidate in allowed:
        return candidate
    return frontend_url()
