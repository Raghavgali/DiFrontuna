import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listTickets, patchTicket } from "@/lib/api";
import { BostonMap } from "@/components/boston-map";
import { IncidentDetailPanel } from "@/components/incident-detail-panel";
import { MOCK_OPERATOR } from "@/lib/operator";
import type { Ticket } from "@/lib/triage";
import { Loader2, Map, PhoneCall, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  PageTopBar,
  PageTopBarHeading,
  PageTopBarIcon,
} from "@/components/page-top-bar";

const POLL_INTERVAL_MS = 3000;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Live Map — Responza Boston" },
      {
        name: "description",
        content:
          "Real-time map of Boston 311 incidents triaged and routed by AI to the right city department.",
      },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTickets = async () => {
      try {
        const data = await listTickets();
        if (!cancelled) {
          setTickets(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(
            `Could not load tickets: ${err instanceof Error ? err.message : "unknown error"}`,
          );
        }
      }
    };

    void loadTickets();
    const interval = window.setInterval(loadTickets, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  const handlePatch = async (id: string, patch: Partial<Ticket>) => {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      await patchTicket(id, patch);
    } catch (err) {
      toast.error(
        `Update failed: ${err instanceof Error ? err.message : "unknown error"}`,
      );
      const fresh = await listTickets().catch(() => null);
      if (fresh) setTickets(fresh);
    }
  };

  const stats = {
    total: tickets.length,
    emergency: tickets.filter((t) => t.severity === "emergency").length,
    open: tickets.filter(
      (t) => !["resolved", "call_interrupted", "transferred"].includes(t.status),
    ).length,
  };

  // A ticket counts as an "active" call only if it hasn't ended AND was
  // created within the last few minutes. Otherwise a ghost ticket (call
  // that never sent an end-of-call-report webhook) shows as "live" forever.
  const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
  const activeCall =
    tickets.find(
      (t) =>
        !t.ended_at &&
        Date.now() - new Date(t.created_at).getTime() < ACTIVE_WINDOW_MS,
    ) ?? null;

  return (
    <main className="relative h-full min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-background">
      {/* Full-bleed map — extends under the floating top bar */}
      <div className="absolute inset-0 min-h-0">
        {loading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <BostonMap
              tickets={tickets}
              selectedId={selectedId}
              onSelect={(t) => setSelectedId(t.id)}
            />

            {!selected && tickets.length > 0 && (
              <div className="absolute right-6 top-24 z-[500] w-[320px] flex flex-col gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="pointer-events-none glass border border-border rounded-3xl p-5 shadow-card"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Sparkles className="size-4" />
                    </div>
                    <h3 className="text-sm font-extrabold tracking-tight">AI Triage Engine</h3>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    The AI has filtered{" "}
                    <span className="font-bold text-foreground">{tickets.length}</span> live calls
                    across Boston and routed them to the right department. Tap any pin on the map
                    to inspect.
                  </p>
                  <div className="space-y-2">
                    <Legend tone="emergency" label="Auto-escalated to 911" />
                    <Legend tone="urgent" label="Urgent civic issue" />
                    <Legend tone="standard" label="Standard 311 call" />
                  </div>
                </motion.div>

                {activeCall && (
                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={() =>
                      void navigate({
                        to: "/incident/$ticketId",
                        params: { ticketId: activeCall.id },
                      })
                    }
                    className="text-left glass border border-success/40 rounded-3xl p-5 shadow-card hover:border-success/70 hover:shadow-float transition"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div className="relative flex size-8 items-center justify-center rounded-xl bg-success/15 text-success">
                        <PhoneCall className="size-4" />
                        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-success animate-pulse ring-2 ring-card" />
                      </div>
                      <h3 className="text-sm font-extrabold tracking-tight">Live Call</h3>
                      <span className="ml-auto text-[10px] font-mono font-bold uppercase tracking-widest text-success">
                        REC
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      Ticket{" "}
                      <span className="font-bold text-foreground">
                        #{activeCall.number ?? activeCall.id.slice(0, 6).toUpperCase()}
                      </span>{" "}
                      in progress
                      {activeCall.caller_name ? ` · ${activeCall.caller_name}` : ""}.
                      <span className="block mt-1 text-[11px] text-success font-semibold">
                        Tap to open transcript →
                      </span>
                    </div>
                  </motion.button>
                )}
              </div>
            )}

            <IncidentDetailPanel
              ticket={selected}
              onClose={() => setSelectedId(null)}
              onPatch={handlePatch}
              onOpenFull={() => {
                if (selected) {
                  void navigate({
                    to: "/incident/$ticketId",
                    params: { ticketId: selected.id },
                  });
                }
              }}
            />
          </>
        )}
      </div>

      <div className="absolute left-4 right-4 top-4 z-[1000] md:left-5 md:right-5">
        <PageTopBar variant="overlay">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex min-w-0 items-center gap-4">
              <PageTopBarIcon>
                <Map className="size-5" strokeWidth={2.25} />
              </PageTopBarIcon>
              <PageTopBarHeading
                eyebrow={
                  <>
                    Operator · {MOCK_OPERATOR.name} · {MOCK_OPERATOR.badge}
                  </>
                }
                title="Boston Operations Map"
              />
            </div>
            <div className="hidden flex-wrap items-center gap-2 lg:flex">
              <StatPill label="Active" value={stats.open} />
              <StatPill label="Total" value={stats.total} />
              <StatPill
                label="911"
                value={stats.emergency}
                tone={stats.emergency > 0 ? "emergency" : "default"}
              />
            </div>
          </div>
          {activeCall && (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-success sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              Live · incoming
            </span>
          )}
        </PageTopBar>
      </div>
    </main>
  );
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "emergency";
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
        tone === "emergency"
          ? "bg-emergency/10 border-emergency/30 text-emergency"
          : "bg-card border-border text-foreground"
      }`}
    >
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-60">
        {label}
      </span>
      <span className="text-sm font-extrabold tabular-nums font-mono">{value}</span>
    </div>
  );
}

function Legend({
  tone,
  label,
}: {
  tone: "emergency" | "urgent" | "standard";
  label: string;
}) {
  const colors = {
    emergency: "bg-emergency",
    urgent: "bg-urgent",
    standard: "bg-primary",
  };
  return (
    <div className="flex items-center gap-2.5 text-xs">
      <span className={`size-2.5 rounded-full ${colors[tone]}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}
