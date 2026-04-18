from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class Urgency(str, Enum):
    emergency = "emergency"
    urgent_non_emergency = "urgent_non_emergency"
    standard = "standard"


class RouteTarget(str, Enum):
    emergency_operator = "emergency_operator"
    non_emergency_311 = "non_emergency_311"
    department_queue = "department_queue"


class TriageResult(BaseModel):
    category: Urgency
    confidence: float = Field(ge=0, le=1)
    high_risk_signals: list[str] = []


class IncidentFields(BaseModel):
    issue_type: str
    location: str | None = None
    urgency: Urgency
    summary: str
    detected_language: str


class RoutingDecision(BaseModel):
    target: RouteTarget
    reason: str
    department: str | None = None


class TranscriptTurn(BaseModel):
    speaker: str  # "caller" | "agent"
    text: str
    at: datetime


class Call(BaseModel):
    id: str
    started_at: datetime
    ended_at: datetime | None = None
    caller_number: str | None = None
    detected_language: str | None = None
    transcript: list[TranscriptTurn] = []
    incident: IncidentFields | None = None
    triage: TriageResult | None = None
    routing: RoutingDecision | None = None
