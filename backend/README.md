# Responza Backend

FastAPI service that answers phone calls, runs multilingual voice triage, and exposes dashboard endpoints.

## Stack
- FastAPI + Uvicorn
- Twilio or Vapi (voice webhook)
- Deepgram / Whisper (STT)
- ElevenLabs / OpenAI (TTS)
- OpenAI or Anthropic (triage + extraction)

## Run
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn app.main:app --reload --port 8000
```

## Layout
- `app/routes/` — HTTP + WebSocket endpoints
- `app/services/` — STT, TTS, language detect, triage, extractor, router
- `app/prompts/` — LLM prompt templates
- `app/models/` — Pydantic schemas (shared contract with frontend)
- `app/storage/` — in-memory / SQLite call store