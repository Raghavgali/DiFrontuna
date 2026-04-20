import json
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import Severity, Status, Ticket, TranscriptTurn
from app.services.extractor import coerce_language, extract_incident_fields
from app.services.geocode import geocode_boston
from app.services.router import EMERGENCY_ROUTING, decide_route
from app.storage.db import SessionLocal
from app.storage.models import TicketRow, TriageEventRow
from app.storage.store import store

DEDUP_WINDOW = timedelta(hours=24)

# Call IDs whose ticket we merged into an older one. Further webhook events
# for these calls must not resurrect the deleted ticket row.
_MERGED_CALL_IDS: set[str] = set()


def _normalize_location(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def _bump_severity(current: str) -> str:
    return "urgent" if current == "standard" else current
from app.vapi.schemas import (
    VapiCall,
    VapiEventRequest,
    VapiToolRequest,
    VapiToolResponse,
    VapiToolResult,
)
from app.vapi.security import verify_vapi_secret

router = APIRouter(
    prefix="/vapi",
    tags=["vapi"],
    dependencies=[Depends(verify_vapi_secret)],
)


def _parse_args(raw: Any) -> dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}
    return {}


def _caller_number(call: VapiCall | None) -> str | None:
    return call.customer.number if call and call.customer else None


def _ensure_ticket(call_id: str, caller_phone: str | None = None) -> Ticket | None:
    if call_id in _MERGED_CALL_IDS:
        return None
    existing = store.get(call_id)
    if existing:
        if caller_phone and not existing.caller_phone:
            existing.caller_phone = caller_phone
            store.upsert(existing)
        return existing
    ticket = Ticket(
        id=call_id,
        created_at=datetime.now(timezone.utc),
        caller_phone=caller_phone,
    )
    store.upsert(ticket)
    return ticket


def _parse_end_of_call_transcript(extras: dict[str, Any]) -> list[TranscriptTurn]:
    """Rebuild a clean turns list from the end-of-call-report payload.

    Vapi sends one of: `messages` (preferred, structured), `artifact.messages`,
    or a plaintext `transcript` string. Prefer the structured list when present.
    """
    messages = extras.get("messages") or (extras.get("artifact") or {}).get("messages") or []
    turns: list[TranscriptTurn] = []
    if isinstance(messages, list) and messages:
        for m in messages:
            if not isinstance(m, dict):
                continue
            role = m.get("role") or ""
            text = (m.get("message") or m.get("content") or "").strip()
            if not text or role not in ("user", "assistant", "bot"):
                continue
            try:
                ts = (
                    datetime.fromtimestamp(float(m["time"]) / 1000, tz=timezone.utc)
                    if m.get("time")
                    else datetime.now(timezone.utc)
                )
            except (ValueError, TypeError):
                ts = datetime.now(timezone.utc)
            turns.append(
                TranscriptTurn(
                    speaker="caller" if role == "user" else "agent",
                    text=text,
                    at=ts,
                )
            )
        return turns

    raw = (extras.get("transcript") or "").strip()
    if raw:
        now = datetime.now(timezone.utc)
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            # Vapi's plaintext format is "User: ..." / "AI: ...".
            speaker = "caller"
            text = line
            if ":" in line:
                head, _, rest = line.partition(":")
                head_low = head.strip().lower()
                if head_low in ("user", "caller"):
                    speaker, text = "caller", rest.strip()
                elif head_low in ("ai", "assistant", "bot", "agent"):
                    speaker, text = "agent", rest.strip()
            if text:
                turns.append(TranscriptTurn(speaker=speaker, text=text, at=now))
    return turns


def _tool_context(payload: VapiToolRequest) -> tuple[str, dict[str, Any], Ticket]:
    msg = payload.message
    if not msg.toolCallList:
        raise HTTPException(status_code=400, detail="no tool calls in payload")
    if not msg.call:
        raise HTTPException(status_code=400, detail="missing call context")
    tool_call = msg.toolCallList[0]
    args = _parse_args(tool_call.function.arguments)
    ticket = _ensure_ticket(msg.call.id, caller_phone=_caller_number(msg.call))
    if ticket is None:
        raise HTTPException(status_code=409, detail="call merged into another ticket")
    return tool_call.id, args, ticket


# ---------- Server events ----------

@router.post("/events")
async def vapi_events(payload: VapiEventRequest) -> dict[str, bool]:
    msg = payload.message
    if not msg.call:
        return {"ok": True}

    ticket = _ensure_ticket(msg.call.id, caller_phone=_caller_number(msg.call))
    if ticket is None:
        return {"ok": True}
    extras = msg.model_dump()

    if msg.type == "transcript":
        role = extras.get("role", "unknown")
        text = (extras.get("transcript") or extras.get("text") or "").strip()
        if text:
            is_final = extras.get("transcriptType") in ("final", None)
            turn = TranscriptTurn(
                speaker="caller" if role == "user" else "agent",
                text=text,
                at=datetime.now(timezone.utc),
            )
            store.upsert_transcript_turn(ticket.id, turn, is_final=is_final)

    elif msg.type == "status-update":
        if extras.get("status") == "ended":
            ticket.ended_at = datetime.now(timezone.utc)
            store.upsert(ticket)

    elif msg.type == "end-of-call-report":
        ticket.ended_at = datetime.now(timezone.utc)
        # Only adjust status if the call didn't already transition to
        # transferred (via escalate_emergency) or resolved (by an operator).
        if ticket.status in (Status.new, Status.in_progress):
            if not ticket.caller_name and not ticket.location:
                ticket.status = Status.call_interrupted
            elif ticket.status == Status.new:
                ticket.status = Status.in_progress
        store.upsert(ticket)

        # Vapi only ships the full transcript once the call ends — overwrite
        # whatever partials we buffered live so the UI sees the clean log.
        final_turns = _parse_end_of_call_transcript(extras)
        if final_turns:
            store.replace_transcript_turns(ticket.id, final_turns)

    return {"ok": True}


# ---------- Function tools ----------

@router.post("/tools/submit_incident", response_model=VapiToolResponse)
async def tool_submit_incident(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, args, ticket = _tool_context(payload)

    fields = extract_incident_fields(args)
    ticket.category = fields["category"]
    # Never downgrade from emergency — escalate_emergency may have fired first.
    if ticket.severity != Severity.emergency:
        ticket.severity = fields["severity"]
    ticket.language = fields["language"]
    ticket.summary = fields["summary"]
    if fields.get("location"):
        ticket.location = fields["location"]
        coords = geocode_boston(fields["location"])
        if coords:
            ticket.latitude, ticket.longitude = coords
    if fields.get("caller_name"):
        ticket.caller_name = fields["caller_name"]

    routing_label, assigned_to = decide_route(ticket.severity, ticket.category)
    ticket.routing = routing_label
    ticket.assigned_to = assigned_to

    # --- Dedup: if a recent ticket at the same (category, location) exists,
    # bump its severity one step (standard -> urgent; urgent/emergency stay)
    # and drop the just-created ticket instead of surfacing a duplicate.
    dup_number: int | None = None
    norm_loc = _normalize_location(ticket.location)
    if norm_loc and ticket.category and ticket.category != "other":
        cutoff = datetime.now(timezone.utc) - DEDUP_WINDOW
        with SessionLocal() as db:
            candidates = (
                db.query(TicketRow)
                .filter(TicketRow.id != ticket.id)
                .filter(TicketRow.category == ticket.category)
                .filter(TicketRow.created_at >= cutoff)
                .order_by(TicketRow.created_at.desc())
                .all()
            )
            dup_row = next(
                (r for r in candidates if _normalize_location(r.location) == norm_loc),
                None,
            )
            if dup_row is not None:
                dup_row.severity = _bump_severity(dup_row.severity)
                dup_row.routing, dup_row.assigned_to = decide_route(
                    Severity(dup_row.severity), dup_row.category
                )
                dup_number = dup_row.number
                current_row = db.get(TicketRow, ticket.id)
                if current_row is not None:
                    db.delete(current_row)
                db.commit()
                _MERGED_CALL_IDS.add(ticket.id)

    if dup_number is not None:
        return VapiToolResponse(
            results=[
                VapiToolResult(
                    toolCallId=tool_id,
                    result=(
                        f"Duplicate report merged into existing ticket #{dup_number}. "
                        f"Severity bumped. Say to the caller: "
                        f"\"A report for this issue has already been filed as ticket "
                        f"number {dup_number}. I've added your call to it and marked it "
                        f"as more urgent. Thank you for calling.\" Then end the call. "
                        "Do not call any more tools."
                    ),
                )
            ]
        )

    store.upsert(ticket)
    store.set_triage_confidence(ticket.id, float(args.get("confidence", 0.9)))
    signals = list(args.get("high_risk_signals") or [])
    if signals:
        store.set_high_risk_signals(ticket.id, signals)

    return VapiToolResponse(
        results=[
            VapiToolResult(
                toolCallId=tool_id,
                result=f"Incident recorded: {ticket.category} ({ticket.severity.value}). {ticket.summary}",
            )
        ]
    )


@router.post("/tools/escalate_emergency", response_model=VapiToolResponse)
async def tool_escalate_emergency(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, args, ticket = _tool_context(payload)

    signal = str(args.get("signal", "unspecified"))
    reason = str(args.get("reason", "")).strip()

    ticket.severity = Severity.emergency
    if args.get("category"):
        ticket.category = str(args["category"])
    if args.get("language"):
        ticket.language = coerce_language(args["language"])
    if args.get("location"):
        ticket.location = str(args["location"])
        coords = geocode_boston(str(args["location"]))
        if coords:
            ticket.latitude, ticket.longitude = coords
    if args.get("caller_name"):
        ticket.caller_name = str(args["caller_name"])
    routing_label, assigned_to = decide_route(ticket.severity, ticket.category)
    if routing_label == "311 — Triage Queue":
        routing_label, assigned_to = EMERGENCY_ROUTING
    ticket.routing = routing_label
    ticket.assigned_to = assigned_to
    ticket.status = Status.transferred
    store.upsert(ticket)

    from app.storage.models import TicketRow

    with SessionLocal() as db:
        row = db.get(TicketRow, ticket.id)
        existing_signals = list(row.high_risk_signals or []) if row else []
        if signal and signal not in existing_signals:
            existing_signals.append(signal)
        if row:
            row.high_risk_signals = existing_signals
        db.add(
            TriageEventRow(
                ticket_id=ticket.id,
                signal=signal,
                at=datetime.now(timezone.utc),
            )
        )
        db.commit()

    return VapiToolResponse(
        results=[
            VapiToolResult(
                toolCallId=tool_id,
                result=(
                    f"Emergency flagged ({signal}). "
                    f"{reason or 'High-risk signal detected.'} "
                    "Transfer the caller to 911 dispatch using the transferCall tool."
                ),
            )
        ]
    )


@router.post("/tools/route_non_emergency", response_model=VapiToolResponse)
async def tool_route_non_emergency(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, args, ticket = _tool_context(payload)

    if args.get("category"):
        ticket.category = str(args["category"])

    if not ticket.category or ticket.category == "other":
        return VapiToolResponse(
            results=[
                VapiToolResult(
                    toolCallId=tool_id,
                    result="Cannot route yet — call submit_incident first so the category is known.",
                )
            ]
        )

    routing_label, assigned_to = decide_route(ticket.severity, ticket.category)
    ticket.routing = routing_label
    ticket.assigned_to = assigned_to
    store.upsert(ticket)

    return VapiToolResponse(
        results=[
            VapiToolResult(
                toolCallId=tool_id,
                result=(
                    f"Routed to {routing_label}. Team on point: {assigned_to}. "
                    "Let the caller know the dispatch, then end the call."
                ),
            )
        ]
    )
