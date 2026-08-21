from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
#from app.schema import ensure_schema
from app.media_urls import MEDIA_URL_PREFIX
from app.routers import health
from app.routers import card_manager
from app.routers import admin_cards
from app.routers import admin_users
from app.routers import auth
from app.routers import email_auth
from app.routers import billing
from app.routers import decks
from app.routers import media
from app.routers import play_rooms
from app.settings import frontend_origins, is_dev

"""
Application entry point for the Mirror Image API.

This module creates the FastAPI app and registers API routers.

Images are NOT mounted as static files: card art and deck covers are served by
`app.routers.media` behind a signature, because the old open `/thumbnails`
mount exposed unreleased card art to anyone who could derive its path.
"""

@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Run startup/shutdown hooks for the API lifecycle.

    Schema setup is intentionally disabled for now, but this is where
    startup work should run before the app begins serving requests.
    """
    #ensure_schema()
    yield


app = FastAPI(title="Mirror Image API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins(),
    # Dev: any localhost / 127.0.0.1 port (Vite 5173, preview, etc.)
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?" if is_dev() else None
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


_MEDIA_PATH_PREFIX = f"/{MEDIA_URL_PREFIX}/"


@app.middleware("http")
async def media_cache_headers(request, call_next):
    """Force full image bodies — FileResponse 304s if If-None-Match is present."""
    if request.url.path.startswith(_MEDIA_PATH_PREFIX):
        # Drop conditional headers before FileResponse can answer 304.
        request.scope["headers"] = [
            (name, value)
            for name, value in request.scope["headers"]
            if name.lower() not in (b"if-none-match", b"if-modified-since")
        ]

    response = await call_next(request)

    if request.url.path.startswith(_MEDIA_PATH_PREFIX):
        response.headers["Cache-Control"] = "no-store"
        if "etag" in response.headers:
            del response.headers["etag"]
        if "last-modified" in response.headers:
            del response.headers["last-modified"]
    return response


app.include_router(health.router)
app.include_router(auth.router)
app.include_router(email_auth.router)
app.include_router(billing.router)
app.include_router(decks.router)
app.include_router(play_rooms.router)
app.include_router(admin_cards.router)
app.include_router(admin_users.router)
app.include_router(card_manager.router)
app.include_router(media.router)

media.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
