"""Lightweight triage helpers used by the Simulate Call endpoint.

The live Vapi path does classification in-prompt; this module exists so the
`POST /api/triage` endpoint can produce a plausible ticket from a raw
transcript without going through Vapi.
"""
import re

from app.models.schemas import Language, Severity

HIGH_RISK_PATTERNS = {
    "medical_emergency": [
        r"\bchest pain\b",
        r"\bnot breathing\b",
        r"\bcan.?t breathe\b",
        r"\bunconscious\b",
        r"\bcollapsed\b",
        r"\bheart attack\b",
        r"\bstroke\b",
        r"\boverdose\b",
        r"\bseizure\b",
        r"\bchoking\b",
        r"\bsevere bleeding\b",
    ],
    "fire": [r"\bfire\b", r"\bsmoke\b", r"\bburning\b"],
    "gas_leak": [r"\bgas leak\b", r"\bsmell(?:ing)? gas\b"],
    "active_assault": [
        r"\bassault\b",
        r"\bbeing attacked\b",
        r"\bweapon\b",
        r"\bgun\b",
        r"\bknife\b",
        r"\bshooter\b",
    ],
    "vehicle_accident_injury": [
        r"\bhit by (?:a )?car\b",
        r"\bcar (?:crash|accident)\b",
        r"\bstruck\b",
    ],
}

CATEGORY_PATTERNS = {
    "noise_residential": [r"\bloud music\b", r"\bparty next door\b", r"\bnoise\b.*\bapartment\b"],
    "noise_street": [r"\bconstruction\b", r"\bjackhammer\b", r"\bloud\b.*\bstreet\b"],
    "pothole": [r"\bpothole\b"],
    "streetlight": [r"\bstreet(?:\s|-)?light\b"],
    "missed_collection": [r"\btrash (?:not )?picked up\b", r"\bgarbage\b.*\bnot collected\b"],
    "illegal_parking": [r"\billegally parked\b", r"\bblocking\b.*\bhydrant\b"],
    "blocked_driveway": [r"\bblocked driveway\b", r"\bblocking my driveway\b"],
    "graffiti": [r"\bgraffiti\b"],
    "no_heat": [r"\bno heat\b"],
    "water_leak": [r"\bwater (?:main )?leak\b", r"\bflooding\b"],
    "fallen_tree": [r"\btree (?:down|fell|fallen)\b"],
}

LANGUAGE_HINTS = {
    Language.spanish: [r"\bhola\b", r"\bayuda\b", r"\bemergencia\b", r"\bmi nombre\b"],
    Language.mandarin: [r"[\u4e00-\u9fff]"],
    Language.hindi: [r"[\u0900-\u097f]", r"\bnamaste\b"],
}


def _match_any(patterns: list[str], text: str) -> str | None:
    for p in patterns:
        if re.search(p, text, re.IGNORECASE):
            return p
    return None


def detect_language(transcript: str) -> Language:
    for lang, patterns in LANGUAGE_HINTS.items():
        if _match_any(patterns, transcript):
            return lang
    return Language.english


def detect_high_risk(transcript: str) -> tuple[Severity, str | None, list[str]]:
    signals: list[str] = []
    matched_category: str | None = None
    for category, patterns in HIGH_RISK_PATTERNS.items():
        for p in patterns:
            if re.search(p, transcript, re.IGNORECASE):
                signals.append(category)
                matched_category = matched_category or category
                break
    if signals:
        return Severity.emergency, matched_category, signals
    return Severity.standard, None, []


def detect_category(transcript: str) -> str:
    for cat, patterns in CATEGORY_PATTERNS.items():
        if _match_any(patterns, transcript):
            return cat
    return "other"


def extract_caller_name(transcript: str) -> str | None:
    for pattern in (
        r"my name is ([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)",
        r"this is ([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)",
        r"me llamo ([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)",
    ):
        m = re.search(pattern, transcript)
        if m:
            return m.group(1).strip()
    return None


def extract_caller_phone(transcript: str) -> str | None:
    m = re.search(r"\b(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})\b", transcript)
    return m.group(1) if m else None


def extract_location(transcript: str) -> str | None:
    m = re.search(
        r"\b(\d{1,5}\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+"
        r"(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way))\b",
        transcript,
    )
    return m.group(1) if m else None
