from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import Language, Severity, Status, Ticket, TicketPatch
from app.storage.store import store

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.get("")
def list_tickets(
    severity: Severity | None = Query(default=None),
    status: Status | None = Query(default=None),
    language: Language | None = Query(default=None),
    q: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> dict:
    tickets, total = store.list_tickets(
        severity=severity.value if severity else None,
        status=status.value if status else None,
        language=language.value if language else None,
        q=q,
        limit=limit,
        offset=offset,
    )
    return {"data": tickets, "total": total, "limit": limit, "offset": offset}


@router.get("/{ticket_id}")
def get_ticket(ticket_id: str) -> Ticket:
    ticket = store.get(ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="ticket not found")
    return ticket


@router.patch("/{ticket_id}")
def patch_ticket(ticket_id: str, patch: TicketPatch) -> Ticket:
    fields = patch.model_dump(exclude_unset=True)
    updated = store.patch(ticket_id, fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="ticket not found")
    return updated
