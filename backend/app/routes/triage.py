import uuid
from datetime import datetime, timezone

from fastapi import APIRouter
from pydantic import BaseModel

from app.models.schemas import Language, Severity, Status, Ticket
from app.services import triage as triage_svc
from app.services.router import decide_route
from app.storage.store import store

router = APIRouter(prefix="/api/triage", tags=["triage"])


class TriageRequest(BaseModel):
    transcript: str
    language: Language | None = None
    caller_name: str | None = None
    caller_phone: str | None = None
    location: str | None = None


@router.post("")
def triage_transcript(req: TriageRequest) -> Ticket:
    """Runs the same triage a Vapi call would produce, from a raw transcript.

    Used by the frontend's 'Simulate Call' dialog to create a ticket without
    actually placing a phone call.
    """
    transcript = req.transcript.strip()

    severity, category, signals = triage_svc.detect_high_risk(transcript)
    if not category:
        category = triage_svc.detect_category(transcript)
    language = req.language or triage_svc.detect_language(transcript)

    caller_name = req.caller_name or triage_svc.extract_caller_name(transcript)
    caller_phone = req.caller_phone or triage_svc.extract_caller_phone(transcript)
    location = req.location or triage_svc.extract_location(transcript)

    summary = transcript if len(transcript) <= 140 else transcript[:137] + "..."
    if severity == Severity.emergency:
        summary = f"[EMERGENCY] {summary}"

    routing_label, assigned_to = decide_route(severity, category)

    ticket = Ticket(
        id=f"sim_{uuid.uuid4().hex[:12]}",
        created_at=datetime.now(timezone.utc),
        caller_name=caller_name,
        caller_phone=caller_phone,
        location=location,
        severity=severity,
        language=language,
        category=category,
        summary=summary,
        transcript=transcript,
        routing=routing_label,
        assigned_to=assigned_to,
        status=Status.new,
    )
    store.upsert(ticket)
    if signals:
        store.set_high_risk_signals(ticket.id, signals)
    return ticket
