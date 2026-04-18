import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

/**
 * Shared “pill” top bar: rounded-full, elevated card surface — matches incident detail header.
 */
export const pageTopBarSurfaceClassName = cn(
  "flex w-full min-w-0 items-center justify-between gap-4 rounded-full border border-border/70",
  "bg-card/95 px-6 py-3 shadow-lg backdrop-blur-sm",
);

const spring = { type: "spring" as const, stiffness: 420, damping: 36, mass: 0.75 };

type PageTopBarProps = {
  children: React.ReactNode;
  /** Default: padded strip under the shell. `overlay` = full-width bar only (e.g. map). */
  variant?: "page" | "overlay";
  className?: string;
};

export function PageTopBar({ children, variant = "page", className }: PageTopBarProps) {
  const header = (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring}
      className={cn(pageTopBarSurfaceClassName, className)}
    >
      {children}
    </motion.header>
  );

  if (variant === "overlay") {
    return header;
  }

  return <div className="shrink-0 px-4 pt-4 md:px-5">{header}</div>;
}

/** Left icon disc — same proportions as incident severity icon area */
export function PageTopBarIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Two-line title block: small caps eyebrow + bold title */
export function PageTopBarHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
        {eyebrow}
      </div>
      <div className="truncate text-lg font-extrabold leading-tight tracking-tight text-foreground">
        {title}
      </div>
    </div>
  );
}
