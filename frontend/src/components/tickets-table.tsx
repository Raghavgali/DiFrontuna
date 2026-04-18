import {
  LANGUAGE_META,
  SEVERITY_SHORT,
  STATUS_LABEL,
  type Ticket,
  severityClasses,
  statusClasses,
  timeAgo,
} from "@/lib/triage";
import { Inbox, ChevronRight, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface TicketsTableProps {
  tickets: Ticket[];
  onSelect: (t: Ticket) => void;
}

export function TicketsTable({ tickets, onSelect }: TicketsTableProps) {
  if (tickets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-3xl border border-border bg-card p-16 text-center shadow-card"
      >
        <div className="mx-auto size-12 rounded-2xl bg-muted flex items-center justify-center">
          <Inbox className="size-6 text-muted-foreground" />
        </div>
        <p className="mt-4 text-sm font-bold">No tickets match your filters</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try adjusting your search or simulate an incoming call.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-3xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[80px_100px_1fr_140px_110px_70px] sm:grid-cols-[80px_100px_1.2fr_2fr_140px_120px_110px_80px_24px] gap-3 px-5 py-3 border-b border-border bg-muted/40 text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">
        <div>Ticket</div>
        <div>Severity</div>
        <div>Caller</div>
        <div className="hidden sm:block">Summary</div>
        <div className="hidden sm:block">Lang</div>
        <div className="hidden sm:block">Routed To</div>
        <div>Status</div>
        <div className="text-right">Time</div>
        <div className="hidden sm:block" />
      </div>

      {/* Rows */}
      <ul className="divide-y divide-border">
        <AnimatePresence initial={false}>
          {tickets.map((t, i) => {
            const lang = LANGUAGE_META[t.language];
            const isEmergency = t.severity === "emergency";
            return (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
                whileHover={{ backgroundColor: "oklch(0 0 0 / 0.02)" }}
                onClick={() => onSelect(t)}
                className={`group relative grid grid-cols-[80px_100px_1fr_140px_110px_70px] sm:grid-cols-[80px_100px_1.2fr_2fr_140px_120px_110px_80px_24px] gap-3 px-5 py-3.5 cursor-pointer items-center transition-colors ${
                  isEmergency ? "bg-emergency/[0.04]" : ""
                }`}
              >
                {isEmergency && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-emergency" />
                )}

                <div className="font-mono text-[11px] text-muted-foreground font-semibold">
                  #{t.id.slice(0, 6).toUpperCase()}
                </div>

                <div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${severityClasses(t.severity)}`}
                  >
                    {isEmergency && <AlertTriangle className="size-2.5" />}
                    {SEVERITY_SHORT[t.severity]}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{t.caller_name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {t.location ?? "—"}
                  </div>
                </div>

                <div className="hidden sm:block min-w-0">
                  <div className="text-sm truncate">{t.summary}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{t.category}</div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs">
                  <span className="text-base leading-none">{lang.flag}</span>
                  <span className="text-muted-foreground">{lang.label}</span>
                </div>

                <div className="hidden sm:block text-[11px] text-muted-foreground truncate">
                  {t.assigned_to ?? <span className="italic opacity-60">Unassigned</span>}
                </div>

                <div>
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${statusClasses(t.status)}`}
                  >
                    {STATUS_LABEL[t.status]}
                  </span>
                </div>

                <div className="text-right text-[11px] text-muted-foreground whitespace-nowrap tabular-nums font-mono">
                  {timeAgo(t.created_at)}
                </div>

                <div className="hidden sm:flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="size-4 text-muted-foreground" />
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
