# Responza

A multilingual AI voice triage layer for city services. Callers reach a
single number; an AI agent answers in their language, detects true
emergencies, hands those off to 911, and files every other report as a
structured 311 ticket on a live operator dashboard.

> **🏆 2nd place** at BU Questrom Hackathon 2026.

## The problem

Cities run their 911 and 311 lines largely manually. Operators burn
minutes on calls that should have been a web-form ticket, emergencies
queue behind noise complaints, and non-English callers get routed
through a translator pipeline that adds latency in a moment where
seconds matter. Responza is a first-touch layer that filters, tags,
and routes before a human ever picks up.

## What it does

- **Answers in the caller's language** — English, Spanish, Mandarin,
  Hindi. Language is auto-detected from the first utterance and the
  assistant mirrors it for the rest of the call.
- **Escalates real emergencies** — on the first sign of a high-risk
  signal (chest pain, fire, gas leak, active violence, vehicle accident
  with injury, etc.) the agent stops questioning, flags the ticket
  `severity=emergency`, and initiates a 911 transfer.
- **Files Boston 311 tickets** — every non-emergency call lands in the
  right city department's queue via a closed category vocabulary
  mapped to ISD, PWD, BTD, BWSC, BPHC, Parks, and BPD-non-emergency.
- **Deduplicates repeat reports** — if a second caller reports the same
  `(category, location)` as an existing ticket inside 24h, we bump the
  original ticket's severity instead of creating a duplicate and tell
  the caller their report was appended to ticket #N.
- **Streams live to operators** — the dashboard shows incoming calls on
  a Boston map in real time, with transcripts that fill in as the call
  progresses and an AI-authored summary, routing decision, and
  confidence score visible before the caller hangs up.

## Architecture

```
┌──────────┐   phone    ┌──────────┐   webhooks    ┌──────────┐
│  Caller  │  ────────▶ │   Vapi   │  ──────────▶  │ FastAPI  │
└──────────┘  any lang  └──────────┘  events+tools │ backend  │
                             │                     └────┬─────┘
                             │  TTS/STT/LLM             │
                             ▼                          │ SQLite
                         (Deepgram +                    │
                          ElevenLabs +                  ▼
                          GPT-class LLM)           ┌─────────┐
                                                   │  Store  │
                                                   └────┬────┘
                                                        │ REST
                                                        ▼
                                                  ┌──────────┐
                                                  │ React +  │
                                                  │ TanStack │
                                                  │ Leaflet  │
                                                  └──────────┘
                                                  Operator dashboard
                                                  (HTTP polling)
```

- **Voice / STT / TTS / LLM orchestration:** [Vapi](https://vapi.ai)
  with Deepgram (transcriber, `multi` language mode), ElevenLabs
  Multilingual v2 (TTS), and a GPT-class LLM for conversation and tool
  calling.
- **Backend:** FastAPI + SQLAlchemy 2.x + SQLite. Exposes Vapi
  webhooks (`/vapi/events`, `/vapi/tools/*`) and a dashboard REST API
  (`/api/tickets`, `/api/analytics`).
- **Frontend:** React + Vite + TanStack Router, Leaflet map with
  TomTom tiles, Radix UI, Framer Motion. Uses HTTP polling (3 s for
  list views, 1 s on the incident detail page) so transcripts and
  triage fields fill in live during a call.
- **Persistence:** SQLite (JSON1 for `transcript_turns` +
  `high_risk_signals`), sequential per-ticket numbers, composite index
  on `(caller_phone, created_at desc)` for fast dedup lookups.
- **Geocoding:** Nominatim (OpenStreetMap) with a Boston viewbox; runs
  on `submit_incident` and whenever an operator edits a location.

## Vapi tool surface

Three function tools the assistant is allowed to call:

| Tool | When | Effect |
|---|---|---|
| `escalate_emergency` | First high-risk signal | Sets severity `emergency`, writes a `TriageEventRow`, flips status to `transferred`, routes to the right 911 desk. |
| `submit_incident` | Non-emergency reports (and post-escalation, to attach location) | Normalizes category, picks severity, runs dedup + geocoding, assigns routing/team. |
| `route_non_emergency` | After `submit_incident` | Confirms the routing label so the agent can read it back to the caller. |

## Languages

Four supported, each with a flat enum value the backend treats as
canonical: `english`, `spanish`, `mandarin`, `hindi`. The system prompt
requires the assistant to reply in the caller's language (in native
script for Hindi and Mandarin) and to emit all tool payloads — summary,
category, reason — in English for the dashboard.

## Local development

Prereqs: Python 3.11+, Node 20+, a Vapi account, an ngrok tunnel.

```bash
# backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # set VAPI_WEBHOOK_SECRET
uvicorn app.main:app --reload --port 8000

# expose to Vapi
ngrok http 8000
# paste the tunnel URL into your Vapi assistant's Server URL + tool URLs
#   Server URL              → https://<ngrok>/vapi/events
#   submit_incident         → https://<ngrok>/vapi/tools/submit_incident
#   escalate_emergency      → https://<ngrok>/vapi/tools/escalate_emergency
#   route_non_emergency     → https://<ngrok>/vapi/tools/route_non_emergency

# frontend
cd ../frontend
bun install            # or npm install
cp .env.example .env   # VITE_API_BASE=http://localhost:8000 (default)
bun run dev            # or npm run dev
```

Configure the Vapi assistant with:
- **Transcriber:** Deepgram, language `multi` (Nova-3 recommended).
- **Voice:** ElevenLabs Multilingual v2.
- **System prompt:** paste `backend/app/vapi/prompts/system.md`.
- **Tools:** schemas documented in `backend/ARCHITECTURE.md`.

## Repository layout

```
backend/
  app/
    main.py                 FastAPI app + lifespan + CORS
    routes/
      vapi.py               Vapi webhook + tool handlers
      tickets.py            GET/PATCH /api/tickets
      analytics.py          Aggregates for the dashboard
      triage.py             Regex-based triage endpoint (demo)
    services/
      router.py             Boston 311 category → dept routing table
      geocode.py            Nominatim forward-geocoder (Boston viewbox)
      extractor.py          Tool-args → ticket fields
      triage.py             Heuristic severity/category/language detection
    storage/
      models.py             SQLAlchemy rows (TicketRow, TriageEventRow)
      store.py              TicketStore: upsert/get/patch/list/transcript
      db.py                 engine, sessionmaker, lightweight migrations
    vapi/
      prompts/system.md     Assistant system prompt
      schemas.py            Pydantic shapes for Vapi webhook bodies
      security.py           x-vapi-secret header verifier
  ARCHITECTURE.md

frontend/
  src/
    routes/                 TanStack file-based routes (map, tickets, incident)
    components/             Map, incident surface, stats strip, transcript
    lib/
      api.ts                fetch client
      triage.ts             shared types, routing presets, timeAgo
```

## Notable design decisions

- **Flat ticket shape.** A Vapi call `id` is the ticket primary key.
  One row per call, no nested calls/tickets split. Keeps the frontend
  simple and the dedup logic cheap.
- **HTTP polling over WebSocket.** For a hackathon time budget,
  polling `listTickets` every 3 s and `getTicket` every 1 s was
  indistinguishable from streaming in the UX and cut out a whole
  layer. Easy to swap for SSE later.
- **Closed category vocabulary.** LLM output is constrained to ~40
  categories mapped to real Boston departments in
  `services/router.py`. Anything outside the vocabulary falls through
  to `other` + a 311 triage queue so nothing is silently dropped.
- **Dedup on (category, normalized location).** Instead of creating a
  second ticket, the existing one's severity bumps one step
  (`standard → urgent`; `urgent`/`emergency` stay). The tool response
  tells the agent to announce the existing ticket number back to the
  caller and end the call.
- **Status machine.** `new → in_progress → resolved`, with two
  terminal states for calls that don't reach the normal flow:
  `transferred` (escalate_emergency fired) and `call_interrupted`
  (call ended before caller_name or location were captured).

## What's next

- Backfill lat/lon for historical tickets whose locations didn't
  geocode at intake.
- Switch frontend polling to SSE for sub-second transcript updates.
- Real `triage_confidence` on the dashboard (currently mocked).
- Auto re-routing when an operator changes the category.
- Outbound callback flow for tickets the operator wants to verify.


