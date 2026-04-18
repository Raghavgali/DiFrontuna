import type { Call } from "../types/call";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";
const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

export async function listCalls(): Promise<Call[]> {
  const res = await fetch(`${API_BASE}/calls`);
  if (!res.ok) throw new Error("failed to list calls");
  return res.json();
}

export async function getCall(id: string): Promise<Call> {
  const res = await fetch(`${API_BASE}/calls/${id}`);
  if (!res.ok) throw new Error("failed to get call");
  return res.json();
}

export function openCallsSocket(): WebSocket {
  return new WebSocket(`${WS_BASE}/ws/calls`);
}
