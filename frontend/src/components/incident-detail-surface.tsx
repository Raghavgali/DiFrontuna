import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ASSIGNEES,
  CATEGORIES,
  LANGUAGE_META,
  ROUTING_OPTIONS,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type Severity,
  type Status,
  type Ticket,
  severityClasses,
  timeAgo,
} from "@/lib/triage";
import { BostonMap } from "@/components/boston-map";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  ShieldAlert,
  Phone,
  MapPin,
  Languages,
  Radio,
  Hash,
  Clock,
  ArrowUpRight,
  Sparkles,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { pageTopBarSurfaceClassName } from "@/components/page-top-bar";

const springSnappy = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.72 };

export interface IncidentDetailSurfaceProps {
  ticket: Ticket;
  onClose: () => void;
  onSaved: () => void;
  onLocalSave?: (ticket: Ticket) => void;
  /** `page` is used under the app shell; `dialog` is fullscreen inside a modal. */
  variant?: "dialog" | "page";
  className?: string;
}

export function IncidentDetailSurface({
  ticket,
  onClose,
  onSaved,
  onLocalSave,
  variant = "page",
  className,
}: IncidentDetailSurfaceProps) {
  const [form, setForm] = useState<Ticket>(ticket);
  const [saving, setSaving] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);

  useEffect(() => {
    setForm(ticket);
  }, [ticket]);

  const update = <K extends keyof Ticket>(key: K, value: Ticket[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);

    if (onLocalSave) {
      onLocalSave(form);
      setSaving(false);
      toast.success("Ticket updated");
      onSaved();
      onClose();
      return;
    }

    const { error } = await supabase
      .from("tickets")
      .update({
        caller_name: form.caller_name,
        caller_phone: form.caller_phone,
        location: form.location,
        severity: form.severity,
        category: form.category,
        routing: form.routing,
        assigned_to: form.assigned_to,
        status: form.status,
        description: form.description,
        summary: form.summary,
      })
      .eq("id", form.id);

    setSaving(false);
    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return;
    }
    toast.success("Ticket updated");
    onSaved();
    onClose();
  };

  const lang = LANGUAGE_META[form.language];
  const isEmergency = form.severity === "emergency";
  const idShort = form.id.slice(0, 7).toUpperCase();

  return (
    <motion.div
      layout={false}
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-hidden",
        variant === "dialog" && "h-full min-h-0 w-full",
        variant === "page" && "h-full min-h-0",
        className,
      )}
      initial={variant === "dialog" ? { opacity: 0.96, scale: 0.992 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-0">
        <BostonMap
          tickets={[form]}
          selectedId={form.id}
          focusTicket={form}
          flyToOnFocus
          onSelect={() => {}}
        />
      </div>

      <div className="absolute left-4 right-4 top-4 z-[1000] md:left-5 md:right-5">
      <motion.header
        variants={{
          hidden: { opacity: 0, y: -14 },
          show: { opacity: 1, y: 0 },
        }}
        initial="hidden"
        animate="show"
        transition={springSnappy}
        className={cn(pageTopBarSurfaceClassName, "px-4 md:px-6")}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
          <div
            className={`size-10 shrink-0 rounded-full flex items-center justify-center ${
              isEmergency
                ? "bg-emergency text-emergency-foreground shadow-emergency"
                : "bg-foreground text-background"
            }`}
          >
            {isEmergency ? <ShieldAlert className="size-5" /> : <Hash className="size-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
              <span>Incident</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {timeAgo(form.created_at)}
              </span>
            </div>
            <div className="text-lg font-extrabold tracking-tight truncate font-mono leading-tight">
              №{idShort}
            </div>
          </div>
          <span
            className={`hidden lg:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${severityClasses(
              form.severity,
            )}`}
          >
            {isEmergency && <ShieldAlert className="size-3" />}
            {SEVERITY_LABEL[form.severity]}
          </span>
          <div className="hidden xl:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate font-medium">{form.location}</span>
          </div>
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-primary px-3 md:px-5 font-bold text-primary-foreground shadow-cobalt hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="hidden sm:inline">Saving</span>
              </>
            ) : (
              <>
                <Save className="size-4" />
                <span className="hidden sm:inline">Save</span>
              </>
            )}
          </Button>
          <button
            onClick={onClose}
            disabled={saving}
            className="size-10 rounded-full bg-card border border-border hover:bg-muted flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
      </motion.header>
      </div>

      <motion.aside
        initial={{ opacity: 0, x: -12, filter: "blur(6px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        transition={{ ...springSnappy, delay: 0.04 }}
        className="absolute left-4 top-24 bottom-4 w-[360px] z-[800] flex flex-col gap-3 overflow-y-auto scrollbar-thin pr-1"
      >
        <div className="flex flex-col gap-3">
          <Panel>
            <SectionLabel>Caller</SectionLabel>
            <div className="flex items-center gap-3 mt-2">
              <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                {form.caller_name.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={form.caller_name}
                  onChange={(e) => update("caller_name", e.target.value)}
                  className="border-0 bg-transparent px-0 h-auto py-0 text-base font-bold focus-visible:ring-0 shadow-none"
                />
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono mt-0.5">
                  <Phone className="size-3" />
                  <Input
                    value={form.caller_phone ?? ""}
                    onChange={(e) => update("caller_phone", e.target.value)}
                    placeholder="—"
                    className="border-0 bg-transparent px-0 h-auto py-0 text-xs font-mono focus-visible:ring-0 shadow-none"
                  />
                </div>
              </div>
              <span className="text-xl" title={lang.label}>
                {lang.flag}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2">
              <MapPin className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <Input
                value={form.location ?? ""}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Address"
                className="border-0 bg-transparent px-0 h-auto py-0 text-sm focus-visible:ring-0 shadow-none"
              />
            </div>
          </Panel>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSnappy, delay: 0.12 }}
            className={`rounded-3xl p-5 shadow-cobalt mt-3 ${
              isEmergency
                ? "bg-emergency text-emergency-foreground"
                : "bg-primary text-primary-foreground"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-80">
                AI Routing Decision
              </span>
              <Sparkles className="size-3.5 opacity-80" />
            </div>
            <div className="text-lg font-extrabold tracking-tight mt-2 leading-tight">
              {form.routing}
            </div>
            <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="opacity-70 font-mono uppercase tracking-widest text-[9px]">
                  Confidence
                </div>
                <div className="font-mono font-extrabold text-sm mt-0.5 tabular-nums">
                  {(85 + (form.id.charCodeAt(0) % 13)).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="opacity-70 font-mono uppercase tracking-widest text-[9px]">
                  Category
                </div>
                <div className="font-bold text-sm mt-0.5 truncate">{form.category}</div>
              </div>
            </div>
          </motion.div>

          <Panel className="mt-3">
            <SectionLabel>Dispatch Controls</SectionLabel>
            <div className="space-y-3 mt-3">
              <ControlRow label="Routing">
                <Select value={form.routing} onValueChange={(v) => update("routing", v)}>
                  <SelectTrigger className="bg-muted/40 border-border rounded-xl text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROUTING_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                    {!ROUTING_OPTIONS.includes(form.routing) && (
                      <SelectItem value={form.routing}>{form.routing}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </ControlRow>

              <div className="grid grid-cols-2 gap-2">
                <ControlRow label="Assigned">
                  <Select
                    value={form.assigned_to ?? "Unassigned"}
                    onValueChange={(v) =>
                      update("assigned_to", v === "Unassigned" ? null : v)
                    }
                  >
                    <SelectTrigger className="bg-muted/40 border-border rounded-xl text-xs h-9">
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
                </ControlRow>

                <ControlRow label="Status">
                  <Select
                    value={form.status}
                    onValueChange={(v) => update("status", v as Status)}
                  >
                    <SelectTrigger className="bg-muted/40 border-border rounded-xl text-xs h-9">
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
                </ControlRow>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ControlRow label="Severity">
                  <Select
                    value={form.severity}
                    onValueChange={(v) => update("severity", v as Severity)}
                  >
                    <SelectTrigger className="bg-muted/40 border-border rounded-xl text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["emergency", "urgent", "standard"] as Severity[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {SEVERITY_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ControlRow>
                <ControlRow label="Category">
                  <Select
                    value={form.category}
                    onValueChange={(v) => update("category", v)}
                  >
                    <SelectTrigger className="bg-muted/40 border-border rounded-xl text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      {!CATEGORIES.includes(form.category) && (
                        <SelectItem value={form.category}>{form.category}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </ControlRow>
              </div>
            </div>
          </Panel>
        </div>
      </motion.aside>

      <motion.aside
        initial={{ opacity: 0, x: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        transition={{ ...springSnappy, delay: 0.06 }}
        className="absolute right-4 top-24 bottom-[280px] w-[360px] z-[800] flex"
      >
        <TranscriptionPanel
          transcript={form.transcript}
          language={lang.label}
          flag={lang.flag}
          showEnglish={showEnglish}
          onToggle={setShowEnglish}
        />
      </motion.aside>

      <motion.div
        initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ ...springSnappy, delay: 0.1 }}
        className="absolute bottom-4 left-[388px] right-[388px] z-[800]"
      >
        <Panel className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-foreground text-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-background/60">
                  AI Triage Summary
                </span>
                <Sparkles className="size-3.5 text-background/60" />
              </div>
              <p className="mt-2 text-sm leading-relaxed font-medium line-clamp-4">
                {form.summary}
              </p>
            </div>

            <div className="flex flex-col">
              <div className="flex items-center justify-between">
                <SectionLabel>Description / Operator Notes</SectionLabel>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                  {(form.description ?? "").length} chars
                </span>
              </div>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Add operator notes, follow-ups, or witness statements…"
                className="mt-2 flex-1 min-h-[110px] resize-none border-0 bg-muted/40 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/40 text-sm leading-relaxed"
              />
            </div>
          </div>
        </Panel>
      </motion.div>
    </motion.div>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`glass border border-border rounded-3xl shadow-float p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Label
      className={`text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground ${className}`}
    >
      {children}
    </Label>
  );
}

function ControlRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function TranscriptionPanel({
  transcript,
  language,
  flag,
  showEnglish,
  onToggle,
}: {
  transcript: string;
  language: string;
  flag: string;
  showEnglish: boolean;
  onToggle: (v: boolean) => void;
}) {
  const segments = useMemo(
    () =>
      transcript
        .split(/(?<=[.!?。])\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [transcript],
  );

  const isEnglish = language === "English";

  const englishView = useMemo(() => {
    if (isEnglish) return segments;
    return segments.map((s) => translateMock(s));
  }, [segments, isEnglish]);

  return (
    <div className="glass rounded-3xl border border-border shadow-float flex flex-col w-full overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative">
            <div className="size-8 rounded-xl bg-emergency/10 text-emergency flex items-center justify-center">
              <Radio className="size-4" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emergency animate-pulse ring-2 ring-card" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold tracking-tight truncate">
              Live Transcription
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <span>{flag}</span>
              <span>{language}</span>
              <span className="text-border">·</span>
              <span className="text-emergency font-bold">REC</span>
            </div>
          </div>
        </div>

        {!isEnglish && (
          <button
            type="button"
            onClick={() => onToggle(!showEnglish)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-colors ${
              showEnglish
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
            title="Toggle English translation"
          >
            <Languages className="size-3" />
            EN
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {segments.map((seg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32, delay: i * 0.035 }}
              className="space-y-1"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0 w-10">
                  00:{String(i * 7).padStart(2, "0")}
                </span>
                <p className="text-sm leading-relaxed flex-1">{seg}</p>
              </div>
              {!isEnglish && showEnglish && (
                <div className="ml-12 pl-3 border-l-2 border-primary/40">
                  <p className="text-xs leading-relaxed text-muted-foreground italic">
                    {englishView[i]}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-emergency animate-pulse" />
          <span className="font-mono tracking-wide">listening…</span>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{segments.length} utterances</span>
        <button className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          Open audio <ArrowUpRight className="size-3" />
        </button>
      </div>
    </div>
  );
}

function translateMock(s: string): string {
  const table: Record<string, string> = {
    "Hola, hay agua saliendo a chorros en la calle, está inundando todo el cruce de la calle 15 con Valencia.":
      "Hello, water is gushing out into the street, it is flooding the entire intersection of 15th and Valencia.",
    "Los carros no pueden pasar.": "Cars cannot get through.",
    "Me llamo Carlos Rivera, mi teléfono es 415-555-0193.":
      "My name is Carlos Rivera, my phone is 415-555-0193.",
    "你好，我想报告一个很大的坑洞，在 Geary Boulevard 和 25th Avenue 的交叉口，已经有好几辆车被损坏了。":
      "Hello, I want to report a very large pothole at the intersection of Geary Boulevard and 25th Avenue. Several cars have already been damaged.",
    "我叫陈伟。": "My name is Chen Wei.",
  };
  return table[s] ?? "[ translated to English ]";
}
