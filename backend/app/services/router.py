from app.models.schemas import Severity

# Boston 311 category → (routing label, assigned_to team).
# Keys must match the closed vocabulary in app/vapi/prompts/system.md.
BOSTON_ROUTING: dict[str, tuple[str, str]] = {
    # --- Emergency escalations ---
    "medical_emergency": ("🚨 Escalate — Boston EMS", "Boston EMS"),
    "fire": ("🚨 Escalate — Boston Fire", "Boston Fire Dept"),
    "active_assault": ("🚨 Escalate — Boston Police", "Boston Police"),
    "gas_leak": ("🚨 Escalate — Boston Fire", "Boston Fire Dept"),
    "vehicle_accident_injury": ("🚨 Escalate — EMS + Boston Police", "Boston EMS"),
    # --- Housing & Buildings (ISD - Inspectional Services) ---
    "no_heat": ("311 — ISD Housing", "ISD Housing Division"),
    "no_hot_water": ("311 — ISD Housing", "ISD Housing Division"),
    "rodents_building": ("311 — ISD Housing", "ISD Housing Division"),
    "mold": ("311 — ISD Housing", "ISD Housing Division"),
    "housing_maintenance": ("311 — ISD Housing", "ISD Housing Division"),
    "construction_noise": ("311 — ISD Building", "ISD Building Division"),
    "illegal_construction": ("311 — ISD Building", "ISD Building Division"),
    "unsafe_building": ("311 — ISD Building", "ISD Building Division"),
    # --- Public Works (PWD) — sanitation, streets ---
    "missed_collection": ("311 — PWD Sanitation", "PWD Sanitation"),
    "dirty_street": ("311 — PWD Street Cleaning", "PWD Street Cleaning"),
    "graffiti": ("311 — PWD Code Enforcement", "PWD Code Enforcement"),
    "illegal_dumping": ("311 — PWD Sanitation", "PWD Sanitation"),
    "overflowing_litter": ("311 — PWD Sanitation", "PWD Sanitation"),
    "pothole": ("311 — PWD Highway", "PWD Highway Maintenance"),
    "damaged_road": ("311 — PWD Highway", "PWD Highway Maintenance"),
    "sidewalk_defect": ("311 — PWD Highway", "PWD Highway Maintenance"),
    "streetlight": ("311 — PWD Lighting", "PWD Lighting"),
    # --- Transportation (BTD) — signs, signals, parking ---
    "traffic_signal": ("311 — BTD Signals", "BTD Signals"),
    "street_sign": ("311 — BTD Signs", "BTD Signs"),
    "blocked_driveway": ("311 — BTD Parking Enforcement", "BTD Parking Enforcement"),
    "illegal_parking": ("311 — BTD Parking Enforcement", "BTD Parking Enforcement"),
    "abandoned_vehicle": ("311 — BTD Parking Enforcement", "BTD Parking Enforcement"),
    # --- Water & Sewer (BWSC) ---
    "water_quality": ("311 — Boston Water & Sewer", "BWSC"),
    "water_leak": ("311 — Boston Water & Sewer", "BWSC"),
    "sewer": ("311 — Boston Water & Sewer", "BWSC"),
    # --- Environment ---
    "air_quality": ("311 — Environment Department", "Environment Dept"),
    # --- Parks & Recreation ---
    "fallen_tree": ("311 — Parks & Recreation", "Parks Department"),
    "tree_damage": ("311 — Parks & Recreation", "Parks Department"),
    "park_maintenance": ("311 — Parks & Recreation", "Parks Department"),
    # --- Public Health (BPHC) ---
    "food_safety": ("311 — Public Health (BPHC)", "BPHC"),
    "rodent_public": ("311 — Public Health (BPHC)", "BPHC"),
    # --- Noise (BPD non-emergency) ---
    "noise_residential": ("311 — BPD Noise", "Boston Police Non-Emergency"),
    "noise_street": ("311 — BPD Noise", "Boston Police Non-Emergency"),
    "noise_vehicle": ("311 — BPD Noise", "Boston Police Non-Emergency"),
}

EMERGENCY_ROUTING = ("🚨 Escalate — 911 Dispatch", "Escalated to 911 Dispatch")
DEFAULT_ROUTING = ("311 — Triage Queue", "311 Triage Queue")


def decide_route(severity: Severity, category: str) -> tuple[str, str]:
    """Return (routing_label, assigned_to) for a given severity + category."""
    if severity == Severity.emergency:
        match = BOSTON_ROUTING.get(category.lower())
        if match and match[0].startswith("🚨"):
            return match
        return EMERGENCY_ROUTING

    match = BOSTON_ROUTING.get(category.lower())
    if match:
        return match
    return DEFAULT_ROUTING
