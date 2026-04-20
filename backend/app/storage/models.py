from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.storage.db import Base


class TicketRow(Base):
    __tablename__ = "tickets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True, index=True, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    caller_name: Mapped[str | None] = mapped_column(String, nullable=True)
    caller_phone: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    severity: Mapped[str] = mapped_column(String, default="standard", index=True)
    language: Mapped[str] = mapped_column(String, default="english")
    category: Mapped[str] = mapped_column(String, default="other")
    summary: Mapped[str] = mapped_column(String, default="")

    routing: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="new", index=True)
    assigned_to: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)

    # Internal state not exposed directly as a field on Ticket
    high_risk_signals: Mapped[list | None] = mapped_column(JSON, nullable=True)
    transcript_turns: Mapped[list | None] = mapped_column(JSON, nullable=True)
    triage_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)

    triage_events: Mapped[list["TriageEventRow"]] = relationship(
        back_populates="ticket", cascade="all, delete-orphan"
    )


class TriageEventRow(Base):
    __tablename__ = "triage_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    signal: Mapped[str] = mapped_column(String)
    at: Mapped[datetime] = mapped_column(DateTime)

    ticket: Mapped[TicketRow] = relationship(back_populates="triage_events")


Index("ix_tickets_phone_created", TicketRow.caller_phone, TicketRow.created_at.desc())
