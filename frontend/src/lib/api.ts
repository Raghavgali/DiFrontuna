import type { Language, Ticket } from "./triage";

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://localhost:8000";

async function handle<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body);
    } catch {
      detail = await res.text();
    }
    throw new Error(`${label} failed (${res.status}): ${detail}`);
  }
  return res.json() as Promise<T>;
}

export interface ListTicketsQuery {
  severity?: Ticket["severity"];
  status?: Ticket["status"];
  language?: Language;
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listTickets(query: ListTicketsQuery = {}): Promise<Ticket[]> {
  const params = new URLSearchParams();
  if (query.severity) params.set("severity", query.severity);
  if (query.status) params.set("status", query.status);
  if (query.language) params.set("language", query.language);
  if (query.q) params.set("q", query.q);
  params.set("limit", String(query.limit ?? 500));
  if (query.offset) params.set("offset", String(query.offset));

  const res = await fetch(`${API_BASE}/api/tickets?${params.toString()}`);
  const body = await handle<{ data: Ticket[]; total: number }>(res, "listTickets");
  return body.data;
}

export async function getTicket(id: string): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(id)}`);
  return handle<Ticket>(res, "getTicket");
}

export async function patchTicket(id: string, patch: Partial<Ticket>): Promise<Ticket> {
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handle<Ticket>(res, "patchTicket");
}
