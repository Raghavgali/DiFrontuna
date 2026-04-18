from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func

from app.storage.db import SessionLocal
from app.storage.models import TicketRow

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _today_start_utc() -> datetime:
    now = datetime.now(timezone.utc)
    return datetime(now.year, now.month, now.day, tzinfo=timezone.utc)


@router.get("/summary")
def summary() -> dict:
    today = _today_start_utc()
    with SessionLocal() as db:
        total = db.query(func.count(TicketRow.id)).scalar() or 0
        open_count = (
            db.query(func.count(TicketRow.id))
            .filter(TicketRow.status != "resolved")
            .scalar()
            or 0
        )
        escalated_today = (
            db.query(func.count(TicketRow.id))
            .filter(TicketRow.severity == "emergency")
            .filter(TicketRow.created_at >= today)
            .scalar()
            or 0
        )
        resolved_today = (
            db.query(func.count(TicketRow.id))
            .filter(TicketRow.status == "resolved")
            .filter(TicketRow.created_at >= today)
            .scalar()
            or 0
        )
        non_emergency = (
            db.query(func.count(TicketRow.id))
            .filter(TicketRow.severity != "emergency")
            .scalar()
            or 0
        )
        avg_seconds = (
            db.query(
                func.avg(
                    func.strftime("%s", TicketRow.ended_at)
                    - func.strftime("%s", TicketRow.created_at)
                )
            )
            .filter(TicketRow.ended_at.isnot(None))
            .scalar()
        )

    filter_rate_pct = round((non_emergency / total) * 100, 1) if total else 0.0
    return {
        "total": total,
        "open": open_count,
        "escalated_today": escalated_today,
        "resolved_today": resolved_today,
        "filter_rate_pct": filter_rate_pct,
        "avg_triage_seconds": int(avg_seconds) if avg_seconds else None,
    }


@router.get("/by-caller")
def by_caller(number: str = Query(..., min_length=3)) -> dict:
    with SessionLocal() as db:
        rows = (
            db.query(TicketRow)
            .filter(TicketRow.caller_phone == number)
            .order_by(TicketRow.created_at.desc())
            .all()
        )
        histogram = {"emergency": 0, "urgent": 0, "standard": 0}
        for r in rows:
            if r.severity in histogram:
                histogram[r.severity] += 1

    return {
        "caller_phone": number,
        "count": len(rows),
        "urgency_histogram": histogram,
        "ticket_ids": [r.id for r in rows],
    }


@router.get("/by-location")
def by_location(q: str | None = Query(default=None)) -> dict:
    with SessionLocal() as db:
        query = db.query(
            TicketRow.location,
            func.count(TicketRow.id).label("count"),
        ).filter(TicketRow.location.isnot(None))

        if q:
            query = query.filter(TicketRow.location.ilike(f"%{q}%"))

        rows = (
            query.group_by(TicketRow.location)
            .order_by(func.count(TicketRow.id).desc())
            .limit(50)
            .all()
        )

        groups = []
        for location, count in rows:
            hist = {"emergency": 0, "urgent": 0, "standard": 0}
            sev_rows = (
                db.query(TicketRow.severity, func.count(TicketRow.id))
                .filter(TicketRow.location == location)
                .group_by(TicketRow.severity)
                .all()
            )
            for sev, n in sev_rows:
                if sev in hist:
                    hist[sev] = n
            groups.append({"location": location, "count": count, "urgency_histogram": hist})

    return {"groups": groups}
