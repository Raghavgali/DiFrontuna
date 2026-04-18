import type { Urgency } from "../types/call";

export default function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  return <span>{urgency}</span>;
}
