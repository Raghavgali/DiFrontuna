from app.models.schemas import (
    IncidentFields,
    RouteTarget,
    RoutingDecision,
    TriageResult,
    Urgency,
)

# NYC 311 issue → responsible agency.
# Keys must match the closed vocabulary in app/vapi/prompts/system.md.
DEPARTMENT_BY_ISSUE: dict[str, str] = {
    # Housing (HPD)
    "no_heat": "HPD - Housing",
    "no_hot_water": "HPD - Housing",
    "rodents_building": "HPD - Housing",
    "mold": "HPD - Housing",
    "housing_maintenance": "HPD - Housing",
    # Sanitation (DSNY)
    "missed_collection": "DSNY - Sanitation",
    "dirty_street": "DSNY - Sanitation",
    "graffiti": "DSNY - Sanitation",
    "illegal_dumping": "DSNY - Sanitation",
    "overflowing_litter": "DSNY - Sanitation",
    # Transportation (DOT)
    "pothole": "DOT - Transportation",
    "streetlight": "DOT - Transportation",
    "traffic_signal": "DOT - Transportation",
    "damaged_road": "DOT - Transportation",
    "street_sign": "DOT - Transportation",
    "sidewalk_defect": "DOT - Transportation",
    # Environmental Protection (DEP)
    "water_quality": "DEP - Environmental",
    "water_leak": "DEP - Environmental",
    "sewer": "DEP - Environmental",
    "air_quality": "DEP - Environmental",
    # Buildings (DOB)
    "construction_noise": "DOB - Buildings",
    "illegal_construction": "DOB - Buildings",
    "unsafe_building": "DOB - Buildings",
    # Parks
    "fallen_tree": "Parks - Forestry",
    "tree_damage": "Parks - Forestry",
    "park_maintenance": "Parks - Maintenance",
    # Health (DOHMH)
    "food_safety": "DOHMH - Health",
    "rodent_public": "DOHMH - Health",
    # NYPD non-emergency (routed via 311)
    "noise_residential": "NYPD - Non-Emergency (311)",
    "noise_street": "NYPD - Non-Emergency (311)",
    "noise_vehicle": "NYPD - Non-Emergency (311)",
    "blocked_driveway": "NYPD - Non-Emergency (311)",
    "illegal_parking": "NYPD - Non-Emergency (311)",
    "abandoned_vehicle": "NYPD - Non-Emergency (311)",
    # Generic fallbacks used by older tool payloads
    "noise_complaint": "NYPD - Non-Emergency (311)",
    "noise": "NYPD - Non-Emergency (311)",
    "parking": "NYPD - Non-Emergency (311)",
    "sanitation": "DSNY - Sanitation",
}


def decide_route(triage: TriageResult, incident: IncidentFields) -> RoutingDecision:
    if triage.category == Urgency.emergency:
        return RoutingDecision(
            target=RouteTarget.emergency_operator,
            reason="High-risk signal detected; immediate escalation.",
        )

    department = DEPARTMENT_BY_ISSUE.get(incident.issue_type.lower())
    if department:
        return RoutingDecision(
            target=RouteTarget.department_queue,
            reason=f"{incident.issue_type} maps to {department}.",
            department=department,
        )

    return RoutingDecision(
        target=RouteTarget.non_emergency_311,
        reason="Standard civic issue; routing to 311.",
    )
