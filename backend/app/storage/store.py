from app.models.schemas import (
    Call,
    IncidentFields,
    RoutingDecision,
    TranscriptTurn,
    TriageResult,
    Urgency,
)
from app.storage.db import SessionLocal
from app.storage.models import CallRow


def _row_to_call(row: CallRow) -> Call:
    incident = None
    if row.urgency and row.issue_type and row.summary:
        incident = IncidentFields(
            issue_type=row.issue_type,
            location=row.location,
            urgency=Urgency(row.urgency),
            summary=row.summary,
            detected_language=row.detected_language or "en",
        )

    triage = None
    if row.urgency and row.triage_confidence is not None:
        triage = TriageResult(
            category=Urgency(row.urgency),
            confidence=row.triage_confidence,
            high_risk_signals=row.high_risk_signals or [],
        )

    routing = None
    if row.routing_target:
        routing = RoutingDecision(
            target=row.routing_target,  # type: ignore[arg-type]
            reason=row.routing_reason or "",
            department=row.routing_department,
        )

    transcript = [TranscriptTurn(**t) for t in (row.transcript or [])]

    return Call(
        id=row.id,
        started_at=row.started_at,
        ended_at=row.ended_at,
        caller_number=row.caller_number,
        detected_language=row.detected_language,
        transcript=transcript,
        incident=incident,
        triage=triage,
        routing=routing,
    )


def _call_to_row_kwargs(call: Call) -> dict:
    return {
        "id": call.id,
        "started_at": call.started_at,
        "ended_at": call.ended_at,
        "caller_number": call.caller_number,
        "detected_language": call.detected_language,
        "issue_type": call.incident.issue_type if call.incident else None,
        "location": call.incident.location if call.incident else None,
        "urgency": call.incident.urgency.value if call.incident else None,
        "summary": call.incident.summary if call.incident else None,
        "routing_target": call.routing.target.value if call.routing else None,
        "routing_reason": call.routing.reason if call.routing else None,
        "routing_department": call.routing.department if call.routing else None,
        "triage_confidence": call.triage.confidence if call.triage else None,
        "high_risk_signals": call.triage.high_risk_signals if call.triage else None,
        "transcript": [t.model_dump(mode="json") for t in call.transcript],
    }


class CallStore:
    def upsert(self, call: Call) -> None:
        with SessionLocal() as db:
            data = _call_to_row_kwargs(call)
            row = db.get(CallRow, call.id)
            if row is None:
                db.add(CallRow(**data))
            else:
                for k, v in data.items():
                    setattr(row, k, v)
            db.commit()

    def get_call(self, call_id: str) -> Call | None:
        with SessionLocal() as db:
            row = db.get(CallRow, call_id)
            return _row_to_call(row) if row else None

    def list_calls(self) -> list[Call]:
        with SessionLocal() as db:
            rows = (
                db.query(CallRow)
                .order_by(CallRow.started_at.desc())
                .limit(200)
                .all()
            )
            return [_row_to_call(r) for r in rows]


store = CallStore()
