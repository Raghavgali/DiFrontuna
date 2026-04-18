# DiFrontuna Backend — Architecture

A multilingual AI voice triage layer for Boston city service calls.
Vapi handles the voice/telephony/LLM stack; the backend is a thin webhook
receiver, ticket store, and dashboard API.

---

## 1. System context

```
 ┌─────────┐         ┌──────────────────────────────────────┐
 │ Caller  │◀──PSTN─▶│               VAPI                   │
 │ (phone) │         │  • Telephony (Twilio under the hood) │
 └─────────┘         │  • STT (Deepgram, multilingual)      │
                     │  • TTS (ElevenLabs multilingual v2)  │
                     │  • LLM orchestration + tool calls    │
                     │  • Language detection + switch       │
                     │  • Interruption / turn-taking        │
                     │  • Call transfer                     │
                     └──────────────┬───────────────────────┘
                                    │ HTTPS webhooks
                                    │ (server events + tool calls)
                                    ▼
                 ┌──────────────────────────────────────┐
                 │        BACKEND (FastAPI)             │
                 │                                      │
                 │  /vapi/events       ← server msgs    │
                 │  /vapi/tools/*      ← function tools │
                 │                                      │
                 │  /api/tickets                        │
                 │  /api/tickets/{id}   (GET / PATCH)   │
                 │  /api/analytics/*                    │
                 │  /api/triage         (sim)           │
                 │                                      │
                 │  SQLite (SQLAlchemy) → Ticket store  │
                 └──────────────┬───────────────────────┘
                                │ REST + HTTP polling
                                ▼
                 ┌──────────────────────────────────────┐
                 │   FRONTEND (Operator Console)        │
                 │   TanStack Router, map + stats       │
                 │   TomTom geocoding, Leaflet map      │
                 └──────────────────────────────────────┘
```

---

## 2. Responsibilities

| Concern | Vapi | Backend | Frontend |
|---|---|---|---|
| Phone number, PSTN, media | ✅ | — | — |
| STT / TTS | ✅ | — | — |
| LLM + conversation | ✅ | — | — |
| Language detect + switch | ✅ | — | — |
| System prompt / persona | Configure on assistant | Author the prompt | — |
| Triage classification | ✅ (in-prompt + tool call) | Receive via webhook | — |
| Structured field extraction | ✅ (tool w/ JSON schema) | Receive + persist | — |
| Routing decision | Calls transfer tool | Decide target + record | — |
| Emergency escalation | Fast-path tool call → transfer | Log + flag ticket | — |
| Persistence / history | — | ✅ SQLite | — |
| Analytics queries | — | ✅ SQL aggregations | — |
| Operator dashboard UI | — | — | ✅ |
| Address → lat/long geocoding | — | — | ✅ (TomTom client-side) |
| Live updates | — | — | ✅ HTTP polling (3s) |

Vapi eats ~80% of the work. Do not build a custom STT/TTS/LLM loop.

---

## 3. Backend components

```
backend/
├── app/
│   ├── main.py              FastAPI app, lifespan init_db
│   ├── config.py            env settings (VAPI_*, DATABASE_URL, PUBLIC_BASE_URL)
│   ├── routes/
│   │   ├── vapi.py          Vapi webhook surfaces (events + 3 tools)
│   │   ├── tickets.py       GET /api/tickets, GET/PATCH /api/tickets/{id}
│   │   ├── analytics.py     /api/analytics/{summary, by-caller, by-location}
│   │   └── triage.py        POST /api/triage — simulate a ticket from a transcript
│   ├── services/
│   │   ├── triage.py        Regex heuristics used by the simulate endpoint
│   │   ├── extractor.py     Normalize Vapi tool args → Ticket-flat fields
│   │   └── router.py        decide_route + Boston 311 routing map
│   ├── vapi/
│   │   ├── schemas.py       Pydantic shapes for Vapi in/out payloads
│   │   ├── security.py      x-vapi-secret header verification dependency
│   │   └── prompts/system.md  Triage persona + Boston closed category vocabulary
│   ├── models/
│   │   └── schemas.py       Pydantic Ticket + enums (Severity / Status / Language)
│   └── storage/
│       ├── db.py            SQLAlchemy engine, Session, Base, init_db()
│       ├── models.py        ORM: TicketRow, TriageEventRow
│       └── store.py         TicketStore — upsert / get / patch / list / ...
└── tests/
```

The Vapi assistant itself is configured via the Vapi dashboard UI, not in
code. Tools, voice, transcriber, model, and the system prompt are all set
on the dashboard for hackathon scope.

### 3.1 Vapi webhook surface

- `POST /vapi/events` — all server messages from Vapi. Dispatch on `type`:
  - `transcript` (final only) → append to `transcript_turns`
  - `status-update` with `status=ended` → set `ended_at`
  - `end-of-call-report` → set `ended_at`, flip `status` from `new` → `in_progress`
- `POST /vapi/tools/escalate_emergency` — fast-path. LLM calls this the
  moment it hears a high-risk signal (chest pain, fire, unconscious, gas
  leak, assault). Backend flags `severity=emergency`, appends
  `high_risk_signals`, writes a `triage_events` row, sets routing to 911.
- `POST /vapi/tools/submit_incident` — LLM calls once it has enough to
  classify (`category`, `location`, `severity`, `summary`, `language`,
  `caller_name?`). Backend persists + picks routing via
  `services/router.decide_route`.
- `POST /vapi/tools/route_non_emergency` — backend returns the routing
  label + assigned-to team given the current ticket's category.

Webhook auth: shared secret sent as `x-vapi-secret` header, verified in
`app/vapi/security.py`. Configured under **Server Settings → HTTP Headers**
on both the assistant and each tool. Empty env var → check skipped
(local dev only).

### 3.2 Dashboard REST (consumed by the operator console)

All endpoints return the flat `Ticket` shape (matches frontend's types).

- `GET /api/tickets?severity=&status=&language=&q=&limit=&offset=`
  → `{ data: Ticket[], total, limit, offset }`
- `GET /api/tickets/{id}` → `Ticket`
- `PATCH /api/tickets/{id}` — partial update; operator edits
  (`status`, `routing`, `assigned_to`, `description`, `caller_name`,
  `caller_phone`, `location`, `latitude`, `longitude`).
- `GET /api/analytics/summary` — feeds the StatsStrip.
  `{ total, open, escalated_today, resolved_today, filter_rate_pct, avg_triage_seconds }`
- `GET /api/analytics/by-caller?number=+1...` —
  `{ caller_phone, count, urgency_histogram, ticket_ids }`
- `GET /api/analytics/by-location?q=` —
  `{ groups: [{ location, count, urgency_histogram }] }`
- `POST /api/triage { transcript, language?, caller_name?, caller_phone?, location? }`
  → `Ticket` — used by the "Simulate Call" dialog in place of the old
  `fake-triage.ts`.

Live updates are served by frontend **HTTP polling** of `GET /api/tickets`
(every ~3s). No WebSocket for the hackathon scope.

---

## 4. Data model

### 4.1 Pydantic (API boundary)

Defined in `app/models/schemas.py` — flat shape matching the frontend:

```python
class Severity(str, Enum):  emergency | urgent | standard
class Status(str, Enum):    new | in_progress | resolved
class Language(str, Enum):  english | spanish | mandarin | hindi

class Ticket(BaseModel):
    id: str
    created_at: datetime
    ended_at: datetime | None
    caller_name: str | None
    caller_phone: str | None
    location: str | None
    latitude: float | None
    longitude: float | None
    severity: Severity
    language: Language
    category: str
    summary: str
    transcript: str           # joined from TranscriptTurn[] on serialization
    routing: str              # e.g. "311 — PWD Highway", "🚨 Escalate — 911 Dispatch"
    status: Status
    assigned_to: str | None
    description: str | None
```

Plus `TicketPatch` for partial PATCH requests.

### 4.2 SQLite schema (via SQLAlchemy ORM)

`app/storage/models.py`:

**`tickets`** — flat, one row per call.

| column | type | notes |
|---|---|---|
| id | TEXT PK | Vapi call id (or `sim_*` for simulated) |
| created_at | DATETIME | |
| ended_at | DATETIME NULL | |
| caller_name | TEXT NULL | |
| caller_phone | TEXT NULL | |
| location | TEXT NULL | |
| latitude | REAL NULL | frontend-geocoded via TomTom |
| longitude | REAL NULL | frontend-geocoded via TomTom |
| severity | TEXT | emergency / urgent / standard |
| language | TEXT | english / spanish / mandarin / hindi |
| category | TEXT | closed vocab (see system.md) |
| summary | TEXT | English, ≤ 25 words |
| routing | TEXT | human-readable dispatch label |
| status | TEXT | new / in_progress / resolved |
| assigned_to | TEXT NULL | team on point |
| description | TEXT NULL | operator notes |
| high_risk_signals | JSON NULL | internal; not exposed in Ticket |
| transcript_turns | JSON NULL | internal; joined to `transcript` string |
| triage_confidence | REAL NULL | internal; future analytics |

**`triage_events`** — append-only log of emergency signals.

| column | type | notes |
|---|---|---|
| id | INTEGER PK | autoincrement |
| ticket_id | TEXT FK → tickets.id | |
| signal | TEXT | e.g. "chest_pain" |
| at | DATETIME | |

Indexes: `tickets(caller_phone)`, `tickets(location)`, `tickets(created_at)`,
`tickets(severity)`, `tickets(status)`, `triage_events(ticket_id)`, plus a
composite `(caller_phone, created_at desc)` for per-caller analytics.

### 4.3 Why SQLite + SQLAlchemy

- **SQLite**: zero-ops, single file, perfect for a one-day demo. Vapi is
  the only network dependency — don't add a second.
- **JSON1 extension** (built into SQLite) handles `transcript_turns` and
  `high_risk_signals`.
- **SQLAlchemy 2.x sync**: simple Session per request; FastAPI runs sync
  handlers in a threadpool. No async complexity for hackathon scope.
- **Migration path**: swap `sqlite:///…` → `postgresql://…` via
  `DATABASE_URL` when/if we productionize. No code changes required.

---

## 5. Demo scenarios

**Scenario 1 — true emergency** ("My father collapsed, not breathing")
1. Vapi streams transcripts → `/vapi/events` → appended to `transcript_turns`.
2. LLM hits high-risk signal → `escalate_emergency` tool call.
3. Backend sets `severity=emergency`, appends `not_breathing` to
   `high_risk_signals`, inserts `triage_events` row, sets routing to
   "🚨 Escalate — Boston EMS".
4. Backend tool response tells Vapi to `transferCall` to operator.
5. `end-of-call-report` finalizes the row.

**Scenario 2 — civic issue** ("loud construction at midnight")
1. Normal conversation for a few turns.
2. LLM calls `submit_incident` with `{category: "construction_noise", severity: "standard", ...}`.
3. Backend persists, picks routing via `BOSTON_ROUTING`
   → "311 — ISD Building", assigned_to "ISD Building Division".
4. LLM follows with `route_non_emergency`, then uses `endCall`.

**Scenario 3 — multilingual (Spanish / Mandarin / Hindi)**
1. Vapi multilingual transcriber detects the language; voice switches.
2. Tool payloads always carry `language` as a full word (`spanish` /
   `mandarin` / `hindi`), `summary` in English.
3. Dashboard renders non-English transcript with English summary
   side-by-side.

---

## 6. Current status

**Built**
- SQLite + SQLAlchemy storage with flat `tickets` table
- Vapi webhook surface: `/vapi/events` + `escalate_emergency` /
  `submit_incident` / `route_non_emergency`
- Shared-secret header auth (`x-vapi-secret`)
- Boston 311 routing map (ISD, PWD, BTD, BWSC, Parks, BPHC, BPD
  non-emergency, emergency services)
- System prompt with multilingual (english / spanish / mandarin / hindi)
  handling and closed `category` vocabulary
- Dashboard REST: `/api/tickets`, `/api/tickets/{id}` (GET + PATCH)
- Analytics: `/api/analytics/{summary, by-caller, by-location}`
- Simulate endpoint: `POST /api/triage`
- Vapi assistant configured via dashboard (tools, voice, transcriber,
  model, prompt)

**Pending (frontend)**
- Rip `src/integrations/supabase/*` usage out of the three route files
- Swap Supabase `postgres_changes` subscription for `setInterval(loadTickets, 3000)`
- Replace `fake-triage.ts` call in `simulate-call-dialog.tsx` with
  `POST /api/triage`
- Drop `VITE_SUPABASE_*`, add `VITE_API_BASE`
- TomTom geocoding on incident submit (address → lat/long) so the map
  pins render

**Pending (optional / later)**
- End-to-end test through ngrok with all three scenarios
- WebSocket broadcaster for sub-second dashboard updates
- Full-text search over transcripts via SQLite FTS5

---

## 7. Deferred / out of scope for hackathon

- Webhook replay / idempotency (Vapi may retry — for demo, we tolerate dupes)
- Auth on dashboard endpoints
- Real 311 / department integrations (mocked as transfer numbers / labels)
- Production secrets management (use `.env` locally, tunnel via ngrok)

---

## 8. Open questions

- Server-side geocoding as a fallback if the frontend TomTom call fails?
- Do we want per-caller rate limiting (same caller, many calls in short window)?
- Analytics endpoint shapes — will adjust once the frontend
  `StatsStrip`/dashboard components are wired against real data.
