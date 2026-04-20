import { useMemo, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { OperatorSidebar } from "@/components/operator-sidebar";
import { StatsStrip } from "@/components/stats-strip";
import { TicketsTable } from "@/components/tickets-table";
import { TicketDetailDialog } from "@/components/ticket-detail-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MOCK_OPERATOR } from "@/lib/operator";
import type { Severity, Status, Ticket } from "@/lib/triage";
import { useTickets } from "@/hooks/use-tickets";
import { Search, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import {
  PageTopBar,
  PageTopBarHeading,
  PageTopBarIcon,
} from "@/components/page-top-bar";

export default function App() {
  const { tickets, update } = useTickets();
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      if (severityFilter !== "all" && t.severity !== severityFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${t.caller_name} ${t.location ?? ""} ${t.summary} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, severityFilter, statusFilter, search]);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full flex-1 overflow-hidden">
      <OperatorSidebar />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PageTopBar>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <PageTopBarIcon>
              <Sparkles className="size-5" strokeWidth={2.25} />
            </PageTopBarIcon>
            <PageTopBarHeading
              eyebrow={
                <>
                  Welcome back, {MOCK_OPERATOR.name.split(" ").slice(-1)[0]} · operator console
                </>
              }
              title="Responza"
            />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" />
              Live
            </span>
          </div>
        </PageTopBar>

        <div className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-8">
          <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card p-5 sm:p-6"
          >
            <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_top_right,oklch(0.7_0.18_200/0.15),transparent_60%)]" />
            <div className="relative flex items-start gap-4">
              <div className="hidden sm:flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-glow">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-semibold tracking-tight">
                  AI is answering the <span className="text-gradient">311 non-emergency line</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  Every call is triaged in the caller's language, structured into a ticket, and
                  routed to the right city department. If a real emergency comes in, the agent
                  auto-escalates to 911 — so dispatchers stay focused on what matters.
                </p>
              </div>
            </div>
          </motion.div>

          <StatsStrip tickets={tickets} />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-2 sm:items-center"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search caller, location, summary…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-border/60"
              />
            </div>
            <div className="flex gap-2">
              <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as Severity | "all")}>
                <SelectTrigger className="w-[160px] bg-card border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="emergency">Escalated to 911</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as Status | "all")}>
                <SelectTrigger className="w-[140px] bg-card border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          <TicketsTable
            tickets={filtered}
            onSelect={(t) => {
              setSelected(t);
              setDetailOpen(true);
            }}
          />
          </div>
        </div>
      </main>

      <TicketDetailDialog
        ticket={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onSaved={() => {}}
        onLocalSave={(t) => update(t.id, t)}
      />
      <Toaster richColors position="top-right" />
    </div>
  );
}
