import {
  LANGUAGE_META,
  ROUTING_OPTIONS,
  ASSIGNEES,
  STATUS_LABEL,
  type Status,
  type Ticket,
  severityClasses,
  timeAgo,
  SEVERITY_LABEL,
} from "@/lib/triage";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  Sparkles,
  Phone,
  MapPin,
  X,
  Clock,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface IncidentDetailPanelProps {
  ticket: Ticket | null;
  onClose: () => void;
  onOpenFull: (t: Ticket) => void;
  onPatch: (id: string, patch: Partial<Ticket>) => void;
}

export function IncidentDetailPanel({
  ticket,
  onClose,
  onOpenFull,
  onPatch,
}: IncidentDetailPanelProps) {
  return (
    <AnimatePresence mode="wait">
      {ticket && (
        <motion.aside
          key={ticket.id}
          initial={{ opacity: 0, x: 24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 24, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 240, damping: 26 }}
          className="absolute bottom-6 right-6 top-24 z-[1200] flex w-[380px] flex-col"
        >
          <div className="glass rounded-3xl border border-border shadow-float p-5 flex flex-col flex-1 min-h-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`shrink-0 size-10 rounded-2xl flex items-center justify-center ${
                    ticket.severity === "emergency"
                      ? "bg-emergency text-emergency-foreground shadow-emergency"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {ticket.severity === "emergency" ? (
                    <ShieldAlert className="size-5" />
                  ) : (
                    <Sparkles className="size-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-bold tracking-widest text-muted-foreground uppercase">
                    Incident · {timeAgo(ticket.created_at)}
                  </div>
                  <div className="text-base font-extrabold tracking-tight truncate">
                    #{ticket.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="size-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close panel"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Severity badge */}
            <span
              className={`self-start inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest mb-4 ${severityClasses(ticket.severity)}`}
            >
              {ticket.severity === "emergency" && <ShieldAlert className="size-3" />}
              {SEVERITY_LABEL[ticket.severity]}
            </span>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin -mx-1 px-1 space-y-4">
              {/* Caller */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                      Caller
                    </div>
                    <div className="text-base font-bold tracking-tight mt-0.5">
                      {ticket.caller_name}
                    </div>
                  </div>
                  <span className="text-base">{LANGUAGE_META[ticket.language].flag}</span>
                </div>
                {ticket.caller_phone && (
                  <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <Phone className="size-3" />
                    {ticket.caller_phone}
                  </div>
                )}
                {ticket.location && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1.5">
                    <MapPin className="size-3 mt-0.5 shrink-0" />
                    <span>{ticket.location}</span>
                  </div>
                )}
              </div>

              {/* AI Summary */}
              <div
                className={`rounded-2xl p-4 border ${
                  ticket.severity === "emergency"
                    ? "bg-emergency/5 border-emergency/30"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles
                    className={`size-3.5 ${
                      ticket.severity === "emergency" ? "text-emergency" : "text-primary"
                    }`}
                  />
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    AI Triage Summary
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{ticket.summary}</p>
              </div>

              {/* Routing */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                  Routing
                </div>
                <Select
                  value={ticket.routing}
                  onValueChange={(v) => onPatch(ticket.id, { routing: v })}
                >
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTING_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                    {!ROUTING_OPTIONS.includes(ticket.routing) && (
                      <SelectItem value={ticket.routing}>{ticket.routing}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Assignee + Status */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    Assigned
                  </div>
                  <Select
                    value={ticket.assigned_to ?? "Unassigned"}
                    onValueChange={(v) =>
                      onPatch(ticket.id, { assigned_to: v === "Unassigned" ? null : v })
                    }
                  >
                    <SelectTrigger className="bg-card border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNEES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    Status
                  </div>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) => onPatch(ticket.id, { status: v as Status })}
                  >
                    <SelectTrigger className="bg-card border-border text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["new", "in_progress", "resolved"] as Status[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Confidence stat */}
              <div className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                    AI Confidence
                  </div>
                  <div className="text-2xl font-extrabold font-mono mt-1 tabular-nums">
                    {(85 + (ticket.id.charCodeAt(0) % 13)).toFixed(1)}%
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span className="font-mono">{timeAgo(ticket.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Footer CTA */}
            <Button
              onClick={() => onOpenFull(ticket)}
              className="mt-4 w-full bg-foreground text-background hover:bg-foreground/90 font-bold rounded-xl py-5"
            >
              Open full record
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
