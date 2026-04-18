import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PRESET_SCENARIOS } from "@/lib/triage";
import { fakeTriage } from "@/lib/fake-triage";
import type { TicketInsert } from "@/lib/triage";
import { toast } from "sonner";
import { Loader2, Phone, Sparkles, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

interface SimulateCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated: (t: TicketInsert) => void;
}

export function SimulateCallDialog({
  open,
  onOpenChange,
  onTicketCreated,
}: SimulateCallDialogProps) {
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const useScenario = (id: string) => {
    const s = PRESET_SCENARIOS.find((p) => p.id === id);
    if (s) {
      setTranscript(s.transcript);
      setActivePreset(id);
    }
  };

  const handleSubmit = async () => {
    if (!transcript.trim()) {
      toast.error("Please enter a transcript or pick a scenario.");
      return;
    }
    setSubmitting(true);
    try {
      const ticket = await fakeTriage(transcript);
      onTicketCreated(ticket);

      if (ticket.severity === "emergency") {
        toast.error("🚨 EMERGENCY DETECTED — Auto-escalated to 911", {
          description: ticket.summary,
          duration: 6000,
        });
      } else if (ticket.severity === "urgent") {
        toast.warning("⚠️ Urgent civic issue logged", { description: ticket.summary });
      } else {
        toast.success("Ticket created", { description: ticket.summary });
      }

      setTranscript("");
      setActivePreset(null);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/60 bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-glow">
              <Phone className="h-4 w-4 text-primary-foreground" />
            </div>
            Simulate Incoming 311 Call
          </DialogTitle>
          <DialogDescription className="text-xs">
            Paste a caller transcript or pick a preset. The AI will triage in their language and
            auto-escalate to 911 if it detects a real emergency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Quick scenarios
            </Label>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((s) => {
                const isMisroute = s.id === "misroute";
                const isActive = activePreset === s.id;
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => useScenario(s.id)}
                    className={`text-left text-xs px-3 py-2.5 rounded-lg border transition-all ${
                      isActive
                        ? isMisroute
                          ? "border-emergency bg-emergency/10 text-emergency"
                          : "border-primary bg-primary/10 text-primary"
                        : isMisroute
                          ? "border-emergency/30 bg-emergency/5 hover:bg-emergency/10 text-foreground"
                          : "border-border bg-secondary hover:bg-accent"
                    }`}
                  >
                    {s.label}
                  </motion.button>
                );
              })}
            </div>
            {activePreset === "misroute" && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 flex items-start gap-2 text-[11px] text-emergency"
              >
                <ShieldAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  This caller dialed 311 by mistake. Watch the AI detect the emergency and
                  auto-escalate to 911.
                </span>
              </motion.div>
            )}
          </div>

          <div>
            <Label
              htmlFor="transcript"
              className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold"
            >
              Caller transcript
            </Label>
            <Textarea
              id="transcript"
              value={transcript}
              onChange={(e) => {
                setTranscript(e.target.value);
                setActivePreset(null);
              }}
              placeholder="e.g. There's loud construction at 650 Divisadero past midnight..."
              rows={6}
              className="mt-2 font-mono text-sm resize-none"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="gradient-primary text-primary-foreground hover:opacity-90 shadow-glow"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Triaging with AI…</>
            ) : (
              <><Sparkles className="h-4 w-4" />Triage Call</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
