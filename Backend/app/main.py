from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
#from app.schema import ensure_schema
from app.routers import health
from app.routers import card_manager
from app.routers import auth

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
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(card_manager.router)

thumbnails_dir = Path(__file__).resolve().parent / "thumbnails"
thumbnails_dir.mkdir(parents=True, exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory=thumbnails_dir), name="thumbnails")
