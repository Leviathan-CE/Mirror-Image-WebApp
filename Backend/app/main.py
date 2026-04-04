from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.routers import health


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(title="Mirror Image API", lifespan=lifespan)
app.include_router(health.router)
