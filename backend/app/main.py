from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analytics, tickets, triage, vapi
from app.storage.db import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="DiFrontuna Triage API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vapi.router)
app.include_router(tickets.router)
app.include_router(analytics.router)
app.include_router(triage.router)


@app.get("/health")
def health():
    return {"status": "ok"}
