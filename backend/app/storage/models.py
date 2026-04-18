from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.storage.db import Base


class CallRow(Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    caller_number: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    detected_language: Mapped[str | None] = mapped_column(String, nullable=True)

    issue_type: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    urgency: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    summary: Mapped[str | None] = mapped_column(String, nullable=True)

    routing_target: Mapped[str | None] = mapped_column(String, nullable=True)
    routing_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    routing_department: Mapped[str | None] = mapped_column(String, nullable=True)

    triage_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    high_risk_signals: Mapped[list | None] = mapped_column(JSON, nullable=True)

    transcript: Mapped[list | None] = mapped_column(JSON, nullable=True)

    triage_events: Mapped[list["TriageEventRow"]] = relationship(
        back_populates="call", cascade="all, delete-orphan"
    )


class TriageEventRow(Base):
    __tablename__ = "triage_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(ForeignKey("calls.id"), index=True)
    signal: Mapped[str] = mapped_column(String)
    at: Mapped[datetime] = mapped_column(DateTime)

    call: Mapped[CallRow] = relationship(back_populates="triage_events")


Index("ix_calls_caller_started", CallRow.caller_number, CallRow.started_at.desc())
