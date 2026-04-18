from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import calls, voice, ws

app = FastAPI(title="DiFrontuna Triage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice.router)
app.include_router(calls.router)
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
