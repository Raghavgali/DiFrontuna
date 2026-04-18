from typing import Any

from app.models.schemas import TriageResult, Urgency


def normalize_triage(args: dict[str, Any]) -> TriageResult:
    category = args.get("category") or args.get("urgency") or "standard"
    return TriageResult(
        category=Urgency(category),
        confidence=float(args.get("confidence", 0.9)),
        high_risk_signals=list(args.get("high_risk_signals") or []),
    )
