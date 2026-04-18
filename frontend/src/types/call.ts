export type Urgency = "emergency" | "urgent_non_emergency" | "standard";

export type RouteTarget =
  | "emergency_operator"
  | "non_emergency_311"
  | "department_queue";

export interface TriageResult {
  category: Urgency;
  confidence: number;
  high_risk_signals: string[];
}

export interface IncidentFields {
  issue_type: string;
  location: string | null;
  urgency: Urgency;
  summary: string;
  detected_language: string;
}

export interface RoutingDecision {
  target: RouteTarget;
  reason: string;
  department: string | null;
}

export interface TranscriptTurn {
  speaker: "caller" | "agent";
  text: string;
  at: string;
}

export interface Call {
  id: string;
  started_at: string;
  ended_at: string | null;
  caller_number: string | null;
  detected_language: string | null;
  transcript: TranscriptTurn[];
  incident: IncidentFields | null;
  triage: TriageResult | null;
  routing: RoutingDecision | null;
}
