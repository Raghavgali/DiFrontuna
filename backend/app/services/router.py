from app.models.schemas import IncidentFields, RoutingDecision, TriageResult


def decide_route(triage: TriageResult, incident: IncidentFields) -> RoutingDecision:
    raise NotImplementedError
