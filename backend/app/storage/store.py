from datetime import datetime, timezone

from sqlalchemy import func

from app.models.schemas import Language, Severity, Status, Ticket, TranscriptTurn
from app.storage.db import SessionLocal
from app.storage.models import TicketRow


def _as_utc(dt: datetime | None) -> datetime | None:
    # SQLite stores naive datetimes; we always write UTC, so reattach tzinfo
    # here so the JSON response carries a proper `+00:00` suffix and the
    # browser doesn't reinterpret it as local time.
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _turns_to_string(turns: list[dict] | None) -> str:
    if not turns:
        return ""
    lines = []
    for t in turns:
        speaker = (t.get("speaker") or "").capitalize() or "?"
        text = (t.get("text") or "").strip()
        if text:
            lines.append(f"{speaker}: {text}")
    return "\n".join(lines)


def _row_to_ticket(row: TicketRow) -> Ticket:
    return Ticket(
        id=row.id,
        number=row.number or 0,
        created_at=_as_utc(row.created_at),
        ended_at=_as_utc(row.ended_at),
        caller_name=row.caller_name or "",
        caller_phone=row.caller_phone,
        location=row.location,
        latitude=row.latitude,
        longitude=row.longitude,
        severity=Severity(row.severity),
        language=Language(row.language),
        category=row.category,
        summary=row.summary,
        transcript=_turns_to_string(row.transcript_turns),
        routing=row.routing,
        status=Status(row.status),
        assigned_to=row.assigned_to,
        description=row.description,
    )


def _apply_ticket_to_row(row: TicketRow, ticket: Ticket) -> None:
    row.created_at = ticket.created_at
    row.ended_at = ticket.ended_at
    row.caller_name = ticket.caller_name
    row.caller_phone = ticket.caller_phone
    row.location = ticket.location
    row.latitude = ticket.latitude
    row.longitude = ticket.longitude
    row.severity = ticket.severity.value
    row.language = ticket.language.value
    row.category = ticket.category
    row.summary = ticket.summary
    row.routing = ticket.routing
    row.status = ticket.status.value
    row.assigned_to = ticket.assigned_to
    row.description = ticket.description


class TicketStore:
    def upsert(self, ticket: Ticket) -> None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket.id)
            if row is None:
                next_num = (
                    db.query(func.coalesce(func.max(TicketRow.number), 0)).scalar() or 0
                ) + 1
                row = TicketRow(id=ticket.id, number=next_num)
                _apply_ticket_to_row(row, ticket)
                db.add(row)
                ticket.number = next_num
            else:
                _apply_ticket_to_row(row, ticket)
            db.commit()

    def get(self, ticket_id: str) -> Ticket | None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            return _row_to_ticket(row) if row else None

    def patch(self, ticket_id: str, fields: dict) -> Ticket | None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            if row is None:
                return None
            for k, v in fields.items():
                if v is None:
                    continue
                if hasattr(row, k):
                    setattr(row, k, v.value if hasattr(v, "value") else v)
            db.commit()
            db.refresh(row)
            return _row_to_ticket(row)

    def list_tickets(
        self,
        *,
        severity: str | None = None,
        status: str | None = None,
        language: str | None = None,
        q: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[Ticket], int]:
        with SessionLocal() as db:
            query = db.query(TicketRow)
            if severity:
                query = query.filter(TicketRow.severity == severity)
            if status:
                query = query.filter(TicketRow.status == status)
            if language:
                query = query.filter(TicketRow.language == language)
            if q:
                needle = f"%{q.lower()}%"
                query = query.filter(
                    (TicketRow.summary.ilike(needle))
                    | (TicketRow.caller_name.ilike(needle))
                    | (TicketRow.location.ilike(needle))
                )
            total = query.count()
            rows = (
                query.order_by(TicketRow.created_at.desc())
                .limit(limit)
                .offset(offset)
                .all()
            )
            return [_row_to_ticket(r) for r in rows], total

    def replace_transcript_turns(
        self, ticket_id: str, turns: list[TranscriptTurn]
    ) -> None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            if row is None:
                return
            row.transcript_turns = [t.model_dump(mode="json") for t in turns]
            db.commit()

    def append_transcript_turn(self, ticket_id: str, turn: TranscriptTurn) -> None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            if row is None:
                return
            turns = list(row.transcript_turns or [])
            turns.append(turn.model_dump(mode="json"))
            row.transcript_turns = turns
            db.commit()

    def upsert_transcript_turn(
        self, ticket_id: str, turn: TranscriptTurn, *, is_final: bool
    ) -> None:
        """Append on final; on partial, replace the last turn if it's the same speaker."""
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            if row is None:
                return
            turns = list(row.transcript_turns or [])
            payload = turn.model_dump(mode="json")
            if is_final:
                # Replace trailing partial from same speaker (if any) with the final.
                if turns and turns[-1].get("speaker") == payload["speaker"] and turns[-1].get(
                    "partial"
                ):
                    turns[-1] = payload
                else:
                    turns.append(payload)
            else:
                payload["partial"] = True
                if turns and turns[-1].get("speaker") == payload["speaker"] and turns[-1].get(
                    "partial"
                ):
                    turns[-1] = payload
                else:
                    turns.append(payload)
            row.transcript_turns = turns
            db.commit()

    def set_high_risk_signals(self, ticket_id: str, signals: list[str]) -> None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            if row is None:
                return
            row.high_risk_signals = signals
            db.commit()

    def set_triage_confidence(self, ticket_id: str, confidence: float) -> None:
        with SessionLocal() as db:
            row = db.get(TicketRow, ticket_id)
            if row is None:
                return
            row.triage_confidence = confidence
            db.commit()


store = TicketStore()
