from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
#from app.schema import ensure_schema
from app.routers import health
from app.routers import card_manager

@asynccontextmanager
async def lifespan(_app: FastAPI):
    #ensure_schema()
    yield


app = FastAPI(title="Mirror Image API", lifespan=lifespan)
app.include_router(health.router)
app.include_router(card_manager.router)

thumbnails_dir = Path(__file__).resolve().parent / "thumbnails"
thumbnails_dir.mkdir(parents=True, exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory=thumbnails_dir), name="thumbnails")
