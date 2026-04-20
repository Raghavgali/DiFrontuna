export type Severity = "emergency" | "urgent" | "standard";
export type Status =
  | "new"
  | "in_progress"
  | "resolved"
  | "call_interrupted"
  | "transferred";
export type Language = "english" | "spanish" | "mandarin" | "hindi";

export interface Ticket {
  id: string;
  number?: number;
  created_at: string;
  ended_at?: string | null;
  caller_name: string;
  caller_phone: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  severity: Severity;
  language: Language;
  category: string;
  summary: string;
  transcript: string;
  routing: string;
  status: Status;
  assigned_to: string | null;
  description: string | null;
}

export type TicketInsert = Partial<Omit<Ticket, "id" | "created_at">> & {
  caller_name: string;
  category: string;
  routing: string;
  summary: string;
  transcript: string;
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  emergency: "Escalated to 911",
  urgent: "Urgent",
  standard: "Standard",
};

export const SEVERITY_SHORT: Record<Severity, string> = {
  emergency: "911",
  urgent: "Urgent",
  standard: "Standard",
};

export const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  in_progress: "In Progress",
  resolved: "Resolved",
  call_interrupted: "Call Interrupted",
  transferred: "Transferred to 911",
};

// `flag` is intentionally a short language code rather than a country flag —
// the caller's spoken language doesn't imply where they're physically located
// (a Hindi speaker reporting a Boston incident shouldn't show 🇮🇳).
export const LANGUAGE_META: Record<Language, { label: string; flag: string }> = {
  english: { label: "English", flag: "EN" },
  spanish: { label: "Spanish", flag: "ES" },
  mandarin: { label: "Mandarin", flag: "中" },
  hindi: { label: "Hindi", flag: "हि" },
};

// Kept in sync with backend/app/services/router.py (BOSTON_ROUTING values).
export const ASSIGNEES = [
  "311 Triage Queue",
  "ISD Housing Division",
  "ISD Building Division",
  "PWD Sanitation",
  "PWD Street Cleaning",
  "PWD Code Enforcement",
  "PWD Highway Maintenance",
  "PWD Lighting",
  "BTD Signals",
  "BTD Signs",
  "BTD Parking Enforcement",
  "BWSC",
  "Environment Dept",
  "Parks Department",
  "BPHC",
  "Boston Police Non-Emergency",
  "Boston EMS",
  "Boston Fire Dept",
  "Boston Police",
  "Escalated to 911 Dispatch",
  "Unassigned",
];

export const ROUTING_OPTIONS = [
  "311 — Triage Queue",
  "311 — ISD Housing",
  "311 — ISD Building",
  "311 — PWD Sanitation",
  "311 — PWD Street Cleaning",
  "311 — PWD Code Enforcement",
  "311 — PWD Highway",
  "311 — PWD Lighting",
  "311 — BTD Signals",
  "311 — BTD Signs",
  "311 — BTD Parking Enforcement",
  "311 — Boston Water & Sewer",
  "311 — Environment Department",
  "311 — Parks & Recreation",
  "311 — Public Health (BPHC)",
  "311 — BPD Noise",
  "🚨 Escalate — Boston EMS",
  "🚨 Escalate — Boston Fire",
  "🚨 Escalate — Boston Police",
  "🚨 Escalate — EMS + Boston Police",
  "🚨 Escalate — 911 Dispatch",
];

// Kept in sync with the closed category vocabulary in
// backend/app/vapi/prompts/system.md (the values the Vapi agent emits).
export const CATEGORIES = [
  "medical_emergency",
  "fire",
  "active_assault",
  "gas_leak",
  "vehicle_accident_injury",
  "no_heat",
  "no_hot_water",
  "rodents_building",
  "mold",
  "housing_maintenance",
  "construction_noise",
  "illegal_construction",
  "unsafe_building",
  "missed_collection",
  "dirty_street",
  "graffiti",
  "illegal_dumping",
  "overflowing_litter",
  "pothole",
  "damaged_road",
  "sidewalk_defect",
  "streetlight",
  "traffic_signal",
  "street_sign",
  "blocked_driveway",
  "illegal_parking",
  "abandoned_vehicle",
  "water_quality",
  "water_leak",
  "sewer",
  "air_quality",
  "fallen_tree",
  "tree_damage",
  "park_maintenance",
  "food_safety",
  "rodent_public",
  "noise_residential",
  "noise_street",
  "noise_vehicle",
  "other",
];

export function severityClasses(s: Severity) {
  switch (s) {
    case "emergency":
      return "bg-emergency text-emergency-foreground shadow-emergency-glow";
    case "urgent":
      return "bg-urgent text-urgent-foreground";
    case "standard":
      return "bg-standard text-standard-foreground";
  }
}

export function statusClasses(s: Status) {
  switch (s) {
    case "new":
      return "bg-primary/15 text-primary border-primary/30";
    case "in_progress":
      return "bg-urgent/15 text-urgent border-urgent/30";
    case "resolved":
      return "bg-success/15 text-success border-success/30";
    case "call_interrupted":
      return "bg-muted text-muted-foreground border-border";
    case "transferred":
      return "bg-emergency/15 text-emergency border-emergency/30";
  }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 6) return `${h}h ago`;
  // Older than ~6h: show wall-clock time (and date if not today).
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (sameDay) return time;
  const dayDiff = Math.floor(h / 24);
  if (dayDiff === 1) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${time}`;
}

// Demo presets — all start as 311 calls, but the "emergency" one slips a real
// emergency into the non-emergency line, which the AI must detect & escalate.
export const PRESET_SCENARIOS: { id: string; label: string; transcript: string }[] = [
  {
    id: "civic",
    label: "📢 Noise complaint (English)",
    transcript:
      "Hi, there is loud construction happening outside my building at 650 Boylston Street and it's already past midnight. This has been going on for two hours and I can't sleep. My name is Aisha Brown.",
  },
  {
    id: "spanish",
    label: "🇪🇸 Water main break (Spanish)",
    transcript:
      "Hola, hay agua saliendo a chorros en la calle, está inundando todo el cruce de la calle 15 con Valencia. Los carros no pueden pasar. Me llamo Carlos Rivera, mi teléfono es 617-555-0193.",
  },
  {
    id: "mandarin",
    label: "🇨🇳 Pothole report (Mandarin)",
    transcript:
      "你好，我想报告一个很大的坑洞，在 Commonwealth Avenue 和 Massachusetts Avenue 的交叉口，已经有好几辆车被损坏了。我叫陈伟。",
  },
  {
    id: "misroute",
    label: "🚨 Caller dialed 311 by mistake — real emergency!",
    transcript:
      "I—I think I called the wrong number, but please help! My father just collapsed in the kitchen and he's not breathing. I'm at 482 Commonwealth Avenue, apartment 3C. I'm Sarah Mitchell, 617-555-0188.",
  },
];
