import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listTickets, patchTicket } from "@/lib/api";
import { BostonMap } from "@/components/boston-map";
import { IncidentDetailPanel } from "@/components/incident-detail-panel";
import { MOCK_OPERATOR } from "@/lib/operator";
import type { Ticket } from "@/lib/triage";
import { Loader2, Map, Sparkles } from "lucide-react";
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
      { title: "Live Map — DiFrontuna Boston" },
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
    open: tickets.filter((t) => t.status !== "resolved").length,
  };

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
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="pointer-events-none absolute right-6 top-24 z-[500] w-[320px] glass border border-border rounded-3xl p-5 shadow-card"
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
          <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-success sm:inline-flex">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Live · incoming
          </span>
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
