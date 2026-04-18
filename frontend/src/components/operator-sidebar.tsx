import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Map, ListChecks, Settings } from "lucide-react";

const primaryNav = [
  { to: "/", label: "Live Map", icon: Map, exact: true },
  { to: "/tickets", label: "Tickets", icon: ListChecks, exact: false },
] as const;

const settingsNav = {
  to: "/settings",
  label: "Settings",
  icon: Settings,
  exact: false,
} as const;

function NavLinkButton({
  to,
  label,
  icon: Icon,
  exact,
}: {
  to: string;
  label: string;
  icon: (typeof primaryNav)[number]["icon"];
  exact: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="group relative flex size-11 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[status=active]:bg-primary data-[status=active]:text-primary-foreground data-[status=active]:shadow-cobalt"
    >
      <Icon className="size-[18px]" strokeWidth={2.25} />
      <span className="pointer-events-none absolute left-full ml-3 translate-x-[-4px] whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-xs font-semibold text-background opacity-0 shadow-float transition-all group-hover:translate-x-0 group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}

export function OperatorSidebar({ alwaysShow = false }: { alwaysShow?: boolean }) {
  return (
    <nav
      className={cn(
        "flex h-[100dvh] max-h-[100dvh] min-h-0 shrink-0 w-[72px] flex-col items-center border-r border-border bg-rail py-6 shadow-[4px_0_24px_rgba(0,0,0,0.02)] z-30",
        alwaysShow ? "flex" : "hidden md:flex",
      )}
    >
      {/* Brand mark — static so route transitions don’t affect the rail */}
      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground text-xs font-bold tracking-tighter text-background shadow-card">
        DF
      </div>

      <div className="my-6 h-px w-7 shrink-0 bg-border" />

      {/* Map + Tickets — stay under brand */}
      <div className="flex shrink-0 flex-col gap-2">
        {primaryNav.map((item) => (
          <NavLinkButton key={item.to} {...item} />
        ))}
      </div>

      {/* Fills space so settings sits on the bottom */}
      <div className="min-h-4 flex-1" aria-hidden />

      <div className="flex shrink-0 flex-col items-center">
        <NavLinkButton
          to={settingsNav.to}
          label={settingsNav.label}
          icon={settingsNav.icon}
          exact={settingsNav.exact}
        />
      </div>
    </nav>
  );
}
