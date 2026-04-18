import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.events import publish
from app.models.schemas import (
    Call,
    RouteTarget,
    RoutingDecision,
    TranscriptTurn,
    TriageResult,
    Urgency,
)
from app.services.extractor import normalize_incident
from app.services.router import decide_route
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


def _ensure_call(call_id: str, caller_number: str | None = None) -> Call:
    existing = store.get_call(call_id)
    if existing:
        if caller_number and not existing.caller_number:
            existing.caller_number = caller_number
            store.upsert(existing)
        return existing
    call = Call(
        id=call_id,
        started_at=datetime.now(timezone.utc),
        caller_number=caller_number,
    )
    store.upsert(call)
    return call


def _tool_call_context(payload: VapiToolRequest) -> tuple[str, dict[str, Any], Call]:
    msg = payload.message
    if not msg.toolCallList:
        raise HTTPException(status_code=400, detail="no tool calls in payload")
    if not msg.call:
        raise HTTPException(status_code=400, detail="missing call context")
    tool_call = msg.toolCallList[0]
    args = _parse_args(tool_call.function.arguments)
    call = _ensure_call(msg.call.id, caller_number=_caller_number(msg.call))
    return tool_call.id, args, call


# ---------- Server events ----------

@router.post("/events")
async def vapi_events(payload: VapiEventRequest) -> dict[str, bool]:
    msg = payload.message
    if not msg.call:
        return {"ok": True}

    call = _ensure_call(msg.call.id, caller_number=_caller_number(msg.call))
    extras = msg.model_dump()

    if msg.type == "transcript":
        role = extras.get("role", "unknown")
        text = (extras.get("transcript") or "").strip()
        t_type = extras.get("transcriptType")
        if t_type == "final" and text:
            turn = TranscriptTurn(
                speaker="caller" if role == "user" else "agent",
                text=text,
                at=datetime.now(timezone.utc),
            )
            call.transcript.append(turn)
            store.upsert(call)
            await publish(
                "transcript.turn",
                {"call_id": call.id, "turn": turn.model_dump(mode="json")},
            )

    elif msg.type == "status-update":
        status_val = extras.get("status")
        await publish(
            "call.status",
            {"call_id": call.id, "status": status_val},
        )
        if status_val == "ended":
            call.ended_at = datetime.now(timezone.utc)
            store.upsert(call)
            await publish("call.ended", {"call_id": call.id})

    elif msg.type == "end-of-call-report":
        call.ended_at = datetime.now(timezone.utc)
        store.upsert(call)
        await publish("call.ended", {"call_id": call.id})

    return {"ok": True}


# ---------- Function tools ----------

@router.post("/tools/submit_incident", response_model=VapiToolResponse)
async def tool_submit_incident(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, args, call = _tool_call_context(payload)

    incident = normalize_incident(args)
    triage = TriageResult(
        category=incident.urgency,
        confidence=float(args.get("confidence", 0.9)),
        high_risk_signals=list(args.get("high_risk_signals") or []),
    )

    call.incident = incident
    call.triage = triage
    call.detected_language = incident.detected_language
    store.upsert(call)

    await publish(
        "incident.updated",
        {"call_id": call.id, "incident": incident.model_dump()},
    )
    await publish(
        "triage.updated",
        {"call_id": call.id, "triage": triage.model_dump()},
    )

    return VapiToolResponse(
        results=[
            VapiToolResult(
                toolCallId=tool_id,
                result=(
                    f"Incident recorded as {incident.urgency.value}. "
                    f"Summary: {incident.summary}"
                ),
            )
        ]
    )


@router.post("/tools/escalate_emergency", response_model=VapiToolResponse)
async def tool_escalate_emergency(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, args, call = _tool_call_context(payload)

    signal = str(args.get("signal", "unspecified"))
    reason = str(args.get("reason", "")).strip()

    existing_signals = list(call.triage.high_risk_signals) if call.triage else []
    if signal and signal not in existing_signals:
        existing_signals.append(signal)

    call.triage = TriageResult(
        category=Urgency.emergency,
        confidence=1.0,
        high_risk_signals=existing_signals,
    )
    if call.incident:
        call.incident.urgency = Urgency.emergency
    call.routing = RoutingDecision(
        target=RouteTarget.emergency_operator,
        reason=reason or f"High-risk signal: {signal}",
    )
    store.upsert(call)

    with SessionLocal() as db:
        db.add(
            TriageEventRow(
                call_id=call.id,
                signal=signal,
                at=datetime.now(timezone.utc),
            )
        )
        db.commit()

    await publish(
        "triage.updated",
        {"call_id": call.id, "triage": call.triage.model_dump()},
    )
    await publish(
        "routing.decided",
        {"call_id": call.id, "routing": call.routing.model_dump()},
    )

    return VapiToolResponse(
        results=[
            VapiToolResult(
                toolCallId=tool_id,
                result=(
                    "Emergency flagged. Transfer the caller to the emergency "
                    "operator immediately using the transferCall tool."
                ),
            )
        ]
    )


@router.post("/tools/route_non_emergency", response_model=VapiToolResponse)
async def tool_route_non_emergency(payload: VapiToolRequest) -> VapiToolResponse:
    tool_id, _args, call = _tool_call_context(payload)

    if not call.incident:
        return VapiToolResponse(
            results=[
                VapiToolResult(
                    toolCallId=tool_id,
                    result=(
                        "Cannot route: incident has not been submitted yet. "
                        "Call submit_incident first."
                    ),
                )
            ]
        )

    triage = call.triage or TriageResult(
        category=call.incident.urgency,
        confidence=0.8,
        high_risk_signals=[],
    )
    routing = decide_route(triage, call.incident)
    call.routing = routing
    store.upsert(call)

    await publish(
        "routing.decided",
        {"call_id": call.id, "routing": routing.model_dump()},
    )

    dept = f" (Department: {routing.department})" if routing.department else ""
    return VapiToolResponse(
        results=[
            VapiToolResult(
                toolCallId=tool_id,
                result=(
                    f"Route to {routing.target.value}{dept}. "
                    f"Reason: {routing.reason}"
                ),
            )
        ]
    )
