import type { Ticket } from "@/lib/triage";
import { ShieldAlert, PhoneIncoming, Timer, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export function StatsStrip({ tickets }: { tickets: Ticket[] }) {
  const open = tickets.filter((t) => t.status !== "resolved").length;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const escalatedToday = tickets.filter(
    (t) => t.severity === "emergency" && new Date(t.created_at) >= todayStart,
  ).length;
  const resolvedToday = tickets.filter(
    (t) => t.status === "resolved" && new Date(t.created_at) >= todayStart,
  ).length;
  const totalToday = tickets.filter((t) => new Date(t.created_at) >= todayStart).length;
  const filterRate =
    totalToday > 0 ? Math.round(((totalToday - escalatedToday) / totalToday) * 100) : 100;

  const stats = [
    {
      label: "Open Tickets",
      value: open,
      icon: <PhoneIncoming className="size-4" />,
      tone: "primary" as const,
      sub: `${tickets.filter((t) => t.status === "new").length} awaiting triage`,
    },
    {
      label: "Escalated to 911",
      value: escalatedToday,
      icon: <ShieldAlert className="size-4" />,
      tone: "emergency" as const,
      sub: "auto-detected today",
    },
    {
      label: "Avg. Triage Time",
      value: "1m 47s",
      icon: <Timer className="size-4" />,
      tone: "urgent" as const,
      sub: "↓ 38% vs. human only",
    },
    {
      label: "Filter Rate",
      value: `${filterRate}%`,
      icon: <TrendingUp className="size-4" />,
      tone: "success" as const,
      sub: `${resolvedToday} resolved today`,
    },
  ];

  const toneStyles = {
    primary: { bg: "bg-primary/10", text: "text-primary", ring: "ring-primary/20" },
    emergency: { bg: "bg-emergency/10", text: "text-emergency", ring: "ring-emergency/30" },
    urgent: { bg: "bg-urgent/15", text: "text-urgent", ring: "ring-urgent/30" },
    success: { bg: "bg-success/10", text: "text-success", ring: "ring-success/30" },
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((s, i) => {
        const t = toneStyles[s.tone];
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 200, damping: 22 }}
            whileHover={{ y: -2 }}
            className="group relative rounded-3xl border border-border bg-card shadow-card p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
                  {s.label}
                </div>
                <motion.div
                  key={String(s.value)}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums font-mono"
                >
                  {s.value}
                </motion.div>
                {s.sub && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{s.sub}</div>
                )}
              </div>
              <div
                className={`flex size-10 items-center justify-center rounded-2xl ring-1 ${t.bg} ${t.text} ${t.ring}`}
              >
                {s.icon}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
