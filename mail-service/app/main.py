from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import consumer
from app.settings import get_settings


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Une variable manquante ou un broker injoignable doit empêcher le
    # démarrage, pas faire attendre les e-mails sans le dire.
    connection = await consumer.start(get_settings())
    yield
    await connection.close()


app = FastAPI(
    title="Mail Service",
    docs_url="/api/docs",
    openapi_url="/api/docs-json",
    redoc_url=None,
    lifespan=lifespan,
)
