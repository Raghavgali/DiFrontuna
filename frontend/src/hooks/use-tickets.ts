import { useCallback, useState } from "react";
import type { Ticket, TicketInsert } from "@/lib/triage";
import { MOCK_TICKETS } from "@/data/mock-tickets";

let counter = 1000;
function genId() {
  counter += 1;
  return `local-${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS);

  const insert = useCallback((t: TicketInsert) => {
    const full: Ticket = {
      id: t.id ?? genId(),
      created_at: t.created_at ?? new Date().toISOString(),
      caller_name: t.caller_name,
      caller_phone: t.caller_phone ?? null,
      location: t.location ?? null,
      latitude: t.latitude ?? null,
      longitude: t.longitude ?? null,
      severity: t.severity ?? "standard",
      language: t.language ?? "english",
      category: t.category,
      summary: t.summary,
      transcript: t.transcript,
      routing: t.routing,
      description: t.description ?? null,
      assigned_to: t.assigned_to ?? null,
      status: t.status ?? "new",
    };
    setTickets((prev) => [full, ...prev]);
    return full;
  }, []);

  const update = useCallback((id: string, patch: Partial<Ticket>) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  return { tickets, insert, update };
}
