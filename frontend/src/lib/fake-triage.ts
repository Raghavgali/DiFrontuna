import type { Severity, Language, TicketInsert } from "@/lib/triage";

const HIGH_RISK = [
  "not breathing", "no breathing", "unconscious", "collapsed", "chest pain",
  "heart attack", "stroke", "bleeding heavily", "gunshot", "stabbed",
  "fire", "smoke", "gas leak", "explosion", "drowning", "overdose",
  "suicide", "assault", "armed", "weapon", "intruder",
];

const SPANISH_HINTS = ["hola", "calle", "está", "agua", "ayuda", "me llamo", "señor"];
const MANDARIN_REGEX = /[\u4e00-\u9fff]/;

function detectLanguage(text: string): Language {
  if (MANDARIN_REGEX.test(text)) return "mandarin";
  const t = text.toLowerCase();
  if (SPANISH_HINTS.some((w) => t.includes(w))) return "spanish";
  return "english";
}

function detectSeverity(text: string): Severity {
  const t = text.toLowerCase();
  if (HIGH_RISK.some((kw) => t.includes(kw))) return "emergency";
  if (/(flooding|burst|main break|broken|dangerous|blocked|trapped|injured)/i.test(text)) {
    return "urgent";
  }
  return "standard";
}

function pickCategory(severity: Severity, text: string): string {
  if (severity === "emergency") {
    if (/(fire|smoke|gas)/i.test(text)) return "Fire (Escalated)";
    if (/(assault|gun|stab|weapon|intruder)/i.test(text)) return "Crime (Escalated)";
    return "Medical (Escalated)";
  }
  if (/(noise|loud|music|construction|party)/i.test(text)) return "Noise Complaint";
  if (/(pothole|street|road|sidewalk|water main|infrastructure)/i.test(text)) return "Infrastructure";
  if (/(trash|garbage|sanitation|dump)/i.test(text)) return "Sanitation";
  if (/(traffic|signal|light|parking)/i.test(text)) return "Traffic";
  if (/(animal|dog|cat|raccoon)/i.test(text)) return "Animal Control";
  if (/(building|window|door|leak)/i.test(text)) return "Building Issue";
  if (/(park|playground|tree)/i.test(text)) return "Parks & Recreation";
  return "Other";
}

function pickRouting(severity: Severity, category: string): string {
  if (severity === "emergency") {
    if (category.startsWith("Fire")) return "🚨 ESCALATE — 911 Fire Department";
    if (category.startsWith("Crime")) return "🚨 ESCALATE — 911 Police Dispatch";
    return "🚨 ESCALATE — 911 EMS Dispatch";
  }
  if (category === "Noise Complaint") return "311 — Noise & Nuisance";
  if (category === "Sanitation") return "311 — Sanitation";
  if (category === "Infrastructure") return "DPW — Streets & Potholes";
  if (category === "Animal Control") return "Animal Control";
  if (category === "Building Issue") return "Building & Safety";
  if (category === "Parks & Recreation") return "Parks Department";
  if (category === "Traffic") return "Transportation Dept.";
  return "311 — General City Services";
}

function extractCallerName(text: string): string {
  const patterns = [
    /(?:my name is|i'm|i am|this is|me llamo|soy)\s+([a-zA-Z\u4e00-\u9fff]+(?:\s+[a-zA-Z\u4e00-\u9fff]+)?)/i,
    /我叫\s*([\u4e00-\u9fff]+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return m[1].trim();
  }
  return "Anonymous Caller";
}

function extractPhone(text: string): string | null {
  const m = text.match(/(\d{3}[\s.-]\d{3}[\s.-]\d{4})/);
  return m?.[1] ?? null;
}

function extractLocation(text: string): string | null {
  const m =
    text.match(/(?:at|en|在)\s+([0-9]{1,5}[^.,;]{3,60}?(?:street|st|avenue|ave|boulevard|blvd|road|rd|calle|apartment|apt)[^.,;]{0,30})/i) ||
    text.match(/([0-9]{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}\s+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd))/);
  if (m?.[1]) return m[1].trim().replace(/\s+/g, " ");
  // Mandarin street pattern
  const zh = text.match(/在\s*([^\s,。]+)\s*(?:和|与)?\s*([^\s,。]+)?/);
  if (zh) return [zh[1], zh[2]].filter(Boolean).join(" & ");
  return null;
}

function summarize(text: string, severity: Severity): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const short = trimmed.length > 140 ? trimmed.slice(0, 137) + "…" : trimmed;
  if (severity === "emergency") return `🚨 EMERGENCY DETECTED on 311 line — ${short}`;
  return short;
}

export async function fakeTriage(transcript: string): Promise<TicketInsert> {
  // Simulate latency so the UI loader is visible
  await new Promise((r) => setTimeout(r, 900));

  const severity = detectSeverity(transcript);
  const language = detectLanguage(transcript);
  const category = pickCategory(severity, transcript);
  const routing = pickRouting(severity, category);

  return {
    caller_name: extractCallerName(transcript),
    caller_phone: extractPhone(transcript),
    location: extractLocation(transcript),
    latitude: null,
    longitude: null,
    severity,
    language,
    category,
    summary: summarize(transcript, severity),
    transcript,
    routing,
    description: null,
    assigned_to: severity === "emergency" ? "Escalated to 911 Dispatch" : null,
    status: severity === "emergency" ? "in_progress" : "new",
  };
}
