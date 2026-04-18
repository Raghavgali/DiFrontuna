import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatsStrip } from "@/components/stats-strip";
import { TicketsTable } from "@/components/tickets-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Severity, Status, Ticket } from "@/lib/triage";
import { Search, Loader2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  PageTopBar,
  PageTopBarHeading,
  PageTopBarIcon,
} from "@/components/page-top-bar";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Tickets — DiFrontuna" },
      {
        name: "description",
        content: "Full queue of all triaged 311 calls with filters and severity routing.",
      },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  

  const loadTickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(`Could not load tickets: ${error.message}`);
      return;
    }
    setTickets(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadTickets();
    const channel = supabase
      .channel("tickets-realtime-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => loadTickets(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(
    () =>
      tickets.filter((t) => {
        if (severityFilter !== "all" && t.severity !== severityFilter) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          const hay =
            `${t.caller_name} ${t.location ?? ""} ${t.summary} ${t.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [tickets, severityFilter, statusFilter, search],
  );

  return (
    <main className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <PageTopBar>
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <PageTopBarIcon>
              <ListChecks className="size-5" strokeWidth={2.25} />
            </PageTopBarIcon>
            <PageTopBarHeading
              eyebrow={
                <>
                  {tickets.length} total · {filtered.length} matching filters
                </>
              }
              title="All Tickets"
            />
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            Live feed
          </span>
        </PageTopBar>

        <div className="mx-auto w-full max-w-[1500px] flex-1 space-y-5 overflow-y-auto px-6 py-6 scrollbar-thin min-h-0">
          <StatsStrip tickets={tickets} />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col sm:flex-row gap-2 sm:items-center"
          >
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search caller, location, summary…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-border rounded-full"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={severityFilter}
                onValueChange={(v) => setSeverityFilter(v as Severity | "all")}
              >
                <SelectTrigger className="w-[160px] bg-card border-border rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="emergency">Escalated to 911</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as Status | "all")}
              >
                <SelectTrigger className="w-[140px] bg-card border-border rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {loading ? (
            <div className="rounded-3xl border border-border bg-card shadow-card p-20 flex items-center justify-center">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TicketsTable
              tickets={filtered}
              onSelect={(t) => {
                void navigate({
                  to: "/incident/$ticketId",
                  params: { ticketId: t.id },
                });
              }}
            />
          )}
        </div>
    </main>
  );
}
