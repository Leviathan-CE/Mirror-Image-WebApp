from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
#from app.schema import ensure_schema
from app.routers import health
from app.routers import card_manager
from app.routers import admin_cards
from app.routers import admin_users
from app.routers import auth
from app.routers import email_auth
from app.routers import billing
from app.routers import decks
from app.settings import frontend_origins, is_dev

"""
Application entry point for the Mirror Image API.

This module creates the FastAPI app, registers API routers, and exposes
the local `thumbnails` directory as static files at `/thumbnails`.
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


@app.middleware("http")
async def thumbnail_cache_headers(request, call_next):
    """Force full thumbnail bodies — StaticFiles 304s if If-None-Match is present."""
    if request.url.path.startswith("/thumbnails/"):
        # Drop conditional headers before StaticFiles can answer 304.
        request.scope["headers"] = [
            (name, value)
            for name, value in request.scope["headers"]
            if name.lower() not in (b"if-none-match", b"if-modified-since")
        ]

    response = await call_next(request)

    if request.url.path.startswith("/thumbnails/"):
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
app.include_router(admin_cards.router)
app.include_router(admin_users.router)
app.include_router(card_manager.router)

thumbnails_dir = Path(__file__).resolve().parent / "thumbnails"
thumbnails_dir.mkdir(parents=True, exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory=thumbnails_dir), name="thumbnails")
