import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import Severity, Status, Ticket, TranscriptTurn
from app.services.extractor import coerce_language, extract_incident_fields
from app.services.router import EMERGENCY_ROUTING, decide_route
from app.storage.db import SessionLocal
from app.storage.models import TriageEventRow
from app.storage.store import store
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


def _ensure_ticket(call_id: str, caller_phone: str | None = None) -> Ticket:
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


def _tool_context(payload: VapiToolRequest) -> tuple[str, dict[str, Any], Ticket]:
    msg = payload.message
    if not msg.toolCallList:
        raise HTTPException(status_code=400, detail="no tool calls in payload")
    if not msg.call:
        raise HTTPException(status_code=400, detail="missing call context")
    tool_call = msg.toolCallList[0]
    args = _parse_args(tool_call.function.arguments)
    ticket = _ensure_ticket(msg.call.id, caller_phone=_caller_number(msg.call))
    return tool_call.id, args, ticket


# ---------- Server events ----------

@router.post("/events")
async def vapi_events(payload: VapiEventRequest) -> dict[str, bool]:
    msg = payload.message
    if not msg.call:
        return {"ok": True}

    ticket = _ensure_ticket(msg.call.id, caller_phone=_caller_number(msg.call))
    extras = msg.model_dump()

    if msg.type == "transcript":
        role = extras.get("role", "unknown")
        text = (extras.get("transcript") or "").strip()
        if extras.get("transcriptType") == "final" and text:
            turn = TranscriptTurn(
                speaker="caller" if role == "user" else "agent",
                text=text,
                at=datetime.now(timezone.utc),
            )
            store.append_transcript_turn(ticket.id, turn)

    elif msg.type == "status-update":
        if extras.get("status") == "ended":
            ticket.ended_at = datetime.now(timezone.utc)
            store.upsert(ticket)

    elif msg.type == "end-of-call-report":
        ticket.ended_at = datetime.now(timezone.utc)
        if ticket.status == Status.new:
            ticket.status = Status.in_progress
        store.upsert(ticket)

    return {"ok": True}


# ---------- Function tools ----------

@router.post("/tools/submit_incident", response_model=VapiToolResponse)
async def tool_submit_incident(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, args, ticket = _tool_context(payload)

    fields = extract_incident_fields(args)
    ticket.category = fields["category"]
    ticket.severity = fields["severity"]
    ticket.language = fields["language"]
    ticket.summary = fields["summary"]
    if fields.get("location"):
        ticket.location = fields["location"]
    if fields.get("caller_name"):
        ticket.caller_name = fields["caller_name"]

    routing_label, assigned_to = decide_route(ticket.severity, ticket.category)
    ticket.routing = routing_label
    ticket.assigned_to = assigned_to

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
    routing_label, assigned_to = decide_route(ticket.severity, ticket.category)
    if routing_label == "311 — Triage Queue":
        routing_label, assigned_to = EMERGENCY_ROUTING
    ticket.routing = routing_label
    ticket.assigned_to = assigned_to
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
