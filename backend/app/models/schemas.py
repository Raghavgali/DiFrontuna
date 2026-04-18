from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class Severity(str, Enum):
    emergency = "emergency"
    urgent = "urgent"
    standard = "standard"


class Status(str, Enum):
    new = "new"
    in_progress = "in_progress"
    resolved = "resolved"


class Language(str, Enum):
    english = "english"
    spanish = "spanish"
    mandarin = "mandarin"
    hindi = "hindi"


class TranscriptTurn(BaseModel):
    speaker: str  # "caller" | "agent"
    text: str
    at: datetime


class Ticket(BaseModel):
    id: str
    created_at: datetime
    ended_at: datetime | None = None

    caller_name: str = ""
    caller_phone: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None

    severity: Severity = Severity.standard
    language: Language = Language.english
    category: str = "other"
    summary: str = ""
    transcript: str = ""

    routing: str = ""
    status: Status = Status.new
    assigned_to: str | None = None
    description: str | None = None


class TicketPatch(BaseModel):
    caller_name: str | None = None
    caller_phone: str | None = None
    location: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    severity: Severity | None = None
    language: Language | None = None
    category: str | None = None
    summary: str | None = None
    routing: str | None = None
    status: Status | None = None
    assigned_to: str | None = None
    description: str | None = None
