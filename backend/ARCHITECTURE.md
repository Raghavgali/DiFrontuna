# DiFrontuna Backend — Architecture

A multilingual AI voice triage layer for city service calls.
Vapi handles the voice/telephony/LLM stack; the backend is a thin webhook receiver, call store, and dashboard API.

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
                 ┌─────────────────────────────────────┐
                 │        BACKEND (FastAPI)            │
                 │                                     │
                 │  /vapi/events   ← server messages   │
                 │  /vapi/tools/*  ← function tools    │
                 │                                     │
                 │  SQLite (SQLAlchemy) → Call history │
                 │  Pub/Sub           → WS /ws/calls   │
                 │  /calls, /calls/{id}                │
                 │  /analytics/*   (caller, location)  │
                 └──────────────┬──────────────────────┘
                                │ REST + WebSocket
                                ▼
                 ┌─────────────────────────────────────┐
                 │   FRONTEND (Operator Dashboard)     │
                 └─────────────────────────────────────┘
```

---

## 2. Responsibilities

| Concern | Vapi | Backend |
|---|---|---|
| Phone number, PSTN, media | ✅ | — |
| STT / TTS | ✅ | — |
| LLM + conversation | ✅ | — |
| Language detect + switch | ✅ | — |
| System prompt / persona | Configure on assistant | Author the prompt |
| Triage classification | ✅ (in-prompt + tool call) | Receive via webhook |
| Structured field extraction | ✅ (tool w/ JSON schema) | Receive + persist |
| Routing decision | Calls transfer tool | Decide target + record |
| Emergency escalation | Fast-path tool call → transfer | Log + notify dashboard |
| Persistence / history | — | ✅ SQLite |
| Analytics queries | — | ✅ SQL aggregations |
| Live dashboard push | — | ✅ WebSocket |
| Operator UI | — | Frontend teammate |

Vapi eats ~80% of the work. Do not build a custom STT/TTS/LLM loop.

---

## 3. Backend components

```
backend/
├── app/
│   ├── main.py              FastAPI app, lifespan init_db
│   ├── config.py            env settings (VAPI_*, DATABASE_URL, PUBLIC_BASE_URL)
│   ├── events.py            in-process pub/sub broker for WS broadcast
│   ├── routes/
│   │   ├── vapi.py          Vapi webhook surfaces (events + 3 tools)
│   │   ├── calls.py         Dashboard REST (/calls, /calls/{id})
│   │   └── ws.py            WebSocket /ws/calls (stub — not yet wired to broker)
│   ├── services/
│   │   ├── triage.py        Normalize triage tool payloads
│   │   ├── extractor.py     Normalize incident tool payloads
│   │   └── router.py        decide_route + NYC 311 DEPARTMENT_BY_ISSUE map
│   ├── vapi/
│   │   ├── schemas.py       Pydantic shapes for Vapi in/out payloads
│   │   ├── security.py      x-vapi-secret header verification dependency
│   │   └── prompts/system.md  Triage persona + NYC closed issue vocabulary
│   ├── models/
│   │   └── schemas.py       Pydantic API shapes (Call, IncidentFields…)
│   └── storage/
│       ├── db.py            SQLAlchemy engine, Session, Base, init_db()
│       ├── models.py        ORM: CallRow, TriageEventRow
│       └── store.py         CallStore — upsert / get_call / list_calls
└── tests/
```

The Vapi assistant itself is configured via the Vapi dashboard UI rather
than in code — tools, voice, transcriber, model, and the system prompt
are all set on the dashboard for hackathon scope. Upgrading to a
code-provisioned `vapi/assistant_config.py` is a future refactor.

### 3.1 Vapi webhook surface

- `POST /vapi/events` — all server messages from Vapi. Dispatch on `type`:
  - `call-start` → create `calls` row
  - `transcript` → append turn, broadcast WS
  - `status-update` → status/flags
  - `end-of-call-report` → finalize (ended_at, final transcript)
- `POST /vapi/tools/escalate_emergency` — fast-path. LLM calls this the
  moment it hears a high-risk signal (chest pain, fire, unconscious, gas
  leak, assault). Backend flags call, broadcasts, and returns a Vapi
  control payload telling it to `transferCall` to the operator line.
- `POST /vapi/tools/submit_incident` — LLM calls once it has enough to
  classify (issue_type, location, urgency, summary, language). Persisted.
- `POST /vapi/tools/route_non_emergency` — backend returns the transfer
  target (311 or department queue) given the incident.

Webhook auth: shared secret sent as `x-vapi-secret` header, verified in
`app/vapi/security.py`. In the Vapi dashboard this is configured under
**Server Settings → HTTP Headers** (not the Credential system) on both
the assistant and each tool. If `VAPI_WEBHOOK_SECRET` is unset the check
is skipped — local dev mode only.

### 3.2 Dashboard REST

- `GET /calls` — recent calls, paginated, filterable by urgency/language
- `GET /calls/{id}` — full call including transcript
- `GET /analytics/by-caller/{number}` — volume, urgency histogram
- `GET /analytics/by-location?q=...` — grouped incident counts
- `WS /ws/calls` — push events: `call.started`, `transcript.turn`,
  `incident.updated`, `triage.updated`, `routing.decided`, `call.ended`

---

## 4. Data model

### 4.1 Pydantic (API boundary)

Already defined in `app/models/schemas.py`:

- `Urgency` enum: `emergency` | `urgent_non_emergency` | `standard`
- `RouteTarget` enum: `emergency_operator` | `non_emergency_311` | `department_queue`
- `TriageResult`, `IncidentFields`, `RoutingDecision`, `TranscriptTurn`, `Call`

These are the shapes the frontend consumes and the shapes Vapi tools submit.

### 4.2 SQLite schema (via SQLAlchemy ORM)

`app/storage/models.py`:

**`calls`** — one row per call, flat fields for aggregation

| column | type | notes |
|---|---|---|
| id | TEXT PK | Vapi call id |
| started_at | DATETIME | |
| ended_at | DATETIME NULL | |
| caller_number | TEXT NULL | for per-caller analytics |
| detected_language | TEXT NULL | ISO 639-1 |
| issue_type | TEXT NULL | "medical", "noise_complaint"… |
| location | TEXT NULL | address/landmark |
| urgency | TEXT NULL | mirrors `Urgency` enum |
| summary | TEXT NULL | English one-liner |
| routing_target | TEXT NULL | mirrors `RouteTarget` enum |
| routing_reason | TEXT NULL | |
| routing_department | TEXT NULL | |
| triage_confidence | REAL NULL | 0-1 |
| high_risk_signals | JSON NULL | e.g. ["not_breathing"] |
| transcript | JSON NULL | list[TranscriptTurn as dict] |

**`triage_events`** — append-only log of emergency signals

| column | type | notes |
|---|---|---|
| id | INTEGER PK | autoincrement |
| call_id | TEXT FK → calls.id | |
| signal | TEXT | e.g. "chest_pain" |
| at | DATETIME | |

Indexes: `calls(caller_number)`, `calls(location)`, `calls(started_at)`,
`calls(urgency)`, `triage_events(call_id)`.

### 4.3 Why SQLite + SQLAlchemy

- **SQLite**: zero-ops, single file, perfect for a one-day demo. Vapi is
  the only network dependency — don't add a second.
- **JSON1 extension** (built into SQLite) handles `transcript` + `high_risk_signals`.
- **SQLAlchemy 2.x sync**: simple Session per request; FastAPI runs sync
  handlers in a threadpool. No async complexity for hackathon scope.
- **Migration path**: swap `sqlite:///…` → `postgresql://…` via `DATABASE_URL`
  when/if we productionize. No code changes required.

Analytics queries like "incidents from this caller" or "top locations by
urgency" are relational `GROUP BY`s — SQL is the right shape, not Mongo.

---

## 5. Demo scenarios

**Scenario 1 — true emergency** ("My father collapsed, not breathing")
1. Vapi streams transcript → `/vapi/events` → WS broadcast.
2. LLM hits high-risk signal → `escalate_emergency` tool call.
3. Backend writes `triage.urgency=emergency`, `high_risk_signals=["not_breathing"]`, inserts `triage_events` row, broadcasts.
4. Backend tool response tells Vapi to `transferCall` to operator.
5. `end-of-call-report` finalizes the row.

**Scenario 2 — civic issue** ("loud construction at midnight")
1. Normal conversation for a few turns.
2. LLM calls `submit_incident` with `{issue_type: "noise_complaint", urgency: "standard", ...}`.
3. Backend persists, broadcasts, then `route_non_emergency` returns the 311 handoff.
4. Vapi plays handoff message and ends politely.

**Scenario 3 — multilingual (Spanish)**
1. Vapi multilingual transcriber detects `es`; voice switches.
2. Tool payloads always carry `detected_language="es"`, `summary` in English (enforced by extractor prompt).
3. Dashboard shows Spanish transcript + English summary side-by-side.

---

## 6. Current status

**Built**
- SQLite + SQLAlchemy storage layer (`calls`, `triage_events`)
- Vapi webhook surface: `/vapi/events` + `escalate_emergency` / `submit_incident` / `route_non_emergency`
- Shared-secret header auth (`x-vapi-secret`)
- NYC 311 routing map covering HPD, DSNY, DOT, DEP, DOB, Parks, DOHMH, NYPD non-emergency
- System prompt with multilingual (en / es / hi) handling and closed `issue_type` vocabulary
- In-process pub/sub broker ready for WebSocket subscribers
- Vapi assistant configured via dashboard (tools, voice, transcriber, model, prompt)

**Pending**
- Dashboard REST beyond `/calls`, `/calls/{id}` (per-caller and per-location analytics)
- WebSocket `/ws/calls` subscriber wiring (currently an echo stub)
- End-to-end test through ngrok against the three demo scenarios

---

## 7. Deferred / out of scope for hackathon

- Webhook replay / idempotency (Vapi may retry — for demo, we tolerate dupes)
- Full-text search (SQLite FTS5) over transcripts — add if time permits
- Auth on dashboard endpoints
- Real 311 / department integrations (mocked as transfer numbers)
- Production secrets management (use `.env` locally, tunnel via ngrok)

---

## 8. Open questions

- In-conversation streaming of structured fields vs single `submit_incident` at end? Starting with single submission for simplicity.
- Do we render the Spanish / Hindi transcript with an inline English gloss, or toggle? (Frontend call, to discuss with teammate.)
- Analytics endpoint shapes (`/analytics/by-caller`, `/analytics/by-location`) — waiting on frontend requirements before fixing.
