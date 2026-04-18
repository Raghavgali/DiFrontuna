import type { Database } from "@/integrations/supabase/types";

export type Ticket = Database["public"]["Tables"]["tickets"]["Row"];
export type TicketInsert = Database["public"]["Tables"]["tickets"]["Insert"];
export type Severity = Database["public"]["Enums"]["ticket_severity"];
export type Status = Database["public"]["Enums"]["ticket_status"];
export type Language = Database["public"]["Enums"]["ticket_language"];

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
};

export const LANGUAGE_META: Record<Language, { label: string; flag: string }> = {
  english: { label: "English", flag: "🇺🇸" },
  spanish: { label: "Spanish", flag: "🇪🇸" },
  mandarin: { label: "Mandarin", flag: "🇨🇳" },
};

// 311-style city service dispatch options (with one 911 escalation path)
export const ASSIGNEES = [
  "311 Triage Queue",
  "Noise Compliance Team",
  "DPW Crew 3",
  "Sanitation Route 12",
  "Animal Control",
  "Building & Safety",
  "Parks Department",
  "Transportation Dept.",
  "Escalated to 911 Dispatch",
  "Unassigned",
];

export const ROUTING_OPTIONS = [
  "311 — General City Services",
  "311 — Sanitation",
  "311 — Noise & Nuisance",
  "DPW — Emergency Maintenance",
  "DPW — Streets & Potholes",
  "Animal Control",
  "Building & Safety",
  "Parks Department",
  "Transportation Dept.",
  "🚨 ESCALATE — 911 EMS Dispatch",
  "🚨 ESCALATE — 911 Fire Department",
  "🚨 ESCALATE — 911 Police Dispatch",
];

export const CATEGORIES = [
  "Noise Complaint",
  "Sanitation",
  "Infrastructure",
  "Traffic",
  "Animal Control",
  "Building Issue",
  "Parks & Recreation",
  "Medical (Escalated)",
  "Fire (Escalated)",
  "Crime (Escalated)",
  "Other",
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
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// Demo presets — all start as 311 calls, but the "emergency" one slips a real
// emergency into the non-emergency line, which the AI must detect & escalate.
export const PRESET_SCENARIOS: { id: string; label: string; transcript: string }[] = [
  {
    id: "civic",
    label: "📢 Noise complaint (English)",
    transcript:
      "Hi, there is loud construction happening outside my building at 650 Divisadero Street and it's already past midnight. This has been going on for two hours and I can't sleep. My name is Aisha Brown.",
  },
  {
    id: "spanish",
    label: "🇪🇸 Water main break (Spanish)",
    transcript:
      "Hola, hay agua saliendo a chorros en la calle, está inundando todo el cruce de la calle 15 con Valencia. Los carros no pueden pasar. Me llamo Carlos Rivera, mi teléfono es 415-555-0193.",
  },
  {
    id: "mandarin",
    label: "🇨🇳 Pothole report (Mandarin)",
    transcript:
      "你好，我想报告一个很大的坑洞，在 Geary Boulevard 和 25th Avenue 的交叉口，已经有好几辆车被损坏了。我叫陈伟。",
  },
  {
    id: "misroute",
    label: "🚨 Caller dialed 311 by mistake — real emergency!",
    transcript:
      "I—I think I called the wrong number, but please help! My father just collapsed in the kitchen and he's not breathing. I'm at 482 Mission Street, apartment 3C. I'm Sarah Mitchell, 415-555-0188.",
  },
];
