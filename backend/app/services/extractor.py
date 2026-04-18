from typing import Any

from app.models.schemas import IncidentFields, Urgency


def normalize_incident(args: dict[str, Any]) -> IncidentFields:
    return IncidentFields(
        issue_type=str(args.get("issue_type", "unknown")),
        location=args.get("location"),
        urgency=Urgency(args.get("urgency", "standard")),
        summary=str(args.get("summary", "")),
        detected_language=str(args.get("detected_language", "en")),
    )
