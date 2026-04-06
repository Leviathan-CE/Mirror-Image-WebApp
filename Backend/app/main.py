from contextlib import asynccontextmanager

from fastapi import FastAPI
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
