from typing import Any

from app.models.schemas import Language, Severity


def coerce_severity(value: Any) -> Severity:
    if not value:
        return Severity.standard
    v = str(value).lower()
    # tolerate legacy "urgent_non_emergency"
    if v in ("urgent_non_emergency", "urgent"):
        return Severity.urgent
    if v == "emergency":
        return Severity.emergency
    return Severity.standard


def coerce_language(value: Any) -> Language:
    if not value:
        return Language.english
    v = str(value).lower()
    aliases = {
        "en": Language.english,
        "english": Language.english,
        "es": Language.spanish,
        "spanish": Language.spanish,
        "zh": Language.mandarin,
        "zh-cn": Language.mandarin,
        "mandarin": Language.mandarin,
        "chinese": Language.mandarin,
        "hi": Language.hindi,
        "hindi": Language.hindi,
    }
    return aliases.get(v, Language.english)


def extract_incident_fields(args: dict[str, Any]) -> dict[str, Any]:
    """Normalize the submit_incident tool args into Ticket-flat fields."""
    return {
        "category": str(args.get("category") or args.get("issue_type") or "other"),
        "location": args.get("location"),
        "severity": coerce_severity(args.get("severity") or args.get("urgency")),
        "summary": str(args.get("summary", "")),
        "language": coerce_language(args.get("language") or args.get("detected_language")),
        "caller_name": args.get("caller_name"),
    }
