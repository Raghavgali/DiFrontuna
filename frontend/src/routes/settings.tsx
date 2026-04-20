import { createFileRoute } from "@tanstack/react-router";
import { MOCK_OPERATOR } from "@/lib/operator";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Globe, Shield, User, Palette, Settings } from "lucide-react";
import { motion } from "framer-motion";
import {
  PageTopBar,
  PageTopBarHeading,
  PageTopBarIcon,
} from "@/components/page-top-bar";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Responza" },
      { name: "description", content: "Operator preferences and dispatch settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <main className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <PageTopBar>
          <div className="flex min-w-0 items-center gap-4">
            <PageTopBarIcon className="bg-muted text-foreground shadow-sm">
              <Settings className="size-5" strokeWidth={2.25} />
            </PageTopBarIcon>
            <PageTopBarHeading
              eyebrow={<>Preferences · {MOCK_OPERATOR.badge}</>}
              title="Settings"
            />
          </div>
        </PageTopBar>

        {/* Full-width scroll region; cards fuse to edges with consistent gutter */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
          <div className="flex min-h-full flex-col px-6 py-6 lg:px-8 lg:py-8">
            <div className="grid w-full flex-1 auto-rows-min grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-12 2xl:gap-6">
              {/* Profile — left / wide cell */}
              <SettingCard
                icon={User}
                title="Operator Profile"
                className="xl:col-span-1 2xl:col-span-5"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Name
                    </Label>
                    <Input defaultValue={MOCK_OPERATOR.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Badge
                    </Label>
                    <Input defaultValue={MOCK_OPERATOR.badge} />
                  </div>
                </div>
              </SettingCard>

              <SettingCard
                icon={Globe}
                title="Translation & Display"
                className="xl:col-span-1 2xl:col-span-7"
              >
                <Toggle
                  label="Auto-translate caller transcripts to English"
                  hint="Show real-time English translation alongside the original language."
                  defaultChecked
                />
                <Toggle label="Show language flag on incident cards" defaultChecked />
              </SettingCard>

              <SettingCard
                icon={Bell}
                title="Alerts & Notifications"
                className="xl:col-span-2 2xl:col-span-12"
              >
                <Toggle
                  label="Sound alarm on 911 escalation"
                  hint="Audible alert when AI auto-escalates a call."
                  defaultChecked
                />
                <Toggle label="Desktop notifications for new urgent tickets" />
                <Toggle label="Daily shift summary email" defaultChecked />
              </SettingCard>

              <SettingCard
                icon={Palette}
                title="Appearance"
                className="xl:col-span-1 2xl:col-span-6"
              >
                <Toggle label="Reduce motion" hint="Disable map pulse and panel animations." />
                <Toggle label="High-contrast incident colors" />
              </SettingCard>

              <SettingCard
                icon={Shield}
                title="Security"
                className="xl:col-span-1 2xl:col-span-6"
              >
                <div className="text-xs leading-relaxed text-muted-foreground">
                  Session locked to your operator badge. All ticket actions are audit-logged with
                  timestamp and assignee.
                </div>
                <Button variant="outline" className="rounded-full">
                  Sign out of all sessions
                </Button>
              </SettingCard>
            </div>
          </div>
        </div>
    </main>
  );
}

function SettingCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col space-y-4 rounded-3xl border border-border bg-card p-6 shadow-card",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <h2 className="text-sm font-extrabold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3">{children}</div>
    </motion.section>
  );
}

function Toggle({
  label,
  hint,
  defaultChecked,
}: {
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
