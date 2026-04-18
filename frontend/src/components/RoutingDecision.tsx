import type { RoutingDecision as Decision } from "../types/call";

export default function RoutingDecision({ decision }: { decision: Decision }) {
  return (
    <div>
      {decision.target} — {decision.reason}
    </div>
  );
}
