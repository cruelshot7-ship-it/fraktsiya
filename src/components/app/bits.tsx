import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { STUDIO } from "@/data/studio";

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-4 left-1/2 z-50 max-w-[calc(100%-2.5rem)] rounded-lg border border-primary/40 bg-card px-4 py-2.5 text-center text-sm shadow-glow-alert"
      style={{ animation: "toast-in 220ms var(--ease-smooth-out)" }}
    >
      {message}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-xs tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </p>
  );
}

export function Surface({
  className,
  glow,
  children,
}: {
  className?: string;
  glow?: "ok" | "alert" | "soft";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl bg-card p-4 shadow-border",
        glow === "ok" && "glow-ok",
        glow === "alert" && "glow-alert",
        glow === "soft" && "glow-soft",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-lg border border-border bg-secondary px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/70";

export function StudioName() {
  return <span className="font-display tracking-[0.16em] text-muted-foreground uppercase">{STUDIO.brand}</span>;
}

export function Avatar({
  initials,
  tone = "none",
  size = "md",
}: {
  initials: string;
  tone?: "ok" | "alert" | "none";
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-display tracking-wide",
        size === "sm" ? "size-9 text-tiny" : "size-11 text-sm",
        tone === "alert" && "bg-primary-dim text-primary",
        tone === "ok" && "bg-ok-dim text-ok",
        tone === "none" && "bg-secondary text-muted-foreground",
      )}
    >
      {initials}
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "ok" | "alert" | "muted" | "solid";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-2xs font-medium whitespace-nowrap",
        tone === "alert" && "bg-primary-dim text-primary",
        tone === "ok" && "bg-ok-dim text-ok",
        tone === "muted" && "bg-secondary text-muted-foreground",
        tone === "solid" && "bg-secondary text-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function ProgressRail({
  value,
  max,
  tone = "ok",
}: {
  value: number;
  max: number;
  tone?: "ok" | "alert";
}) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="h-1 overflow-hidden rounded-full bg-secondary">
      <span
        className={cn("block h-full rounded-full transition-[width] duration-500", tone === "alert" ? "bg-primary" : "bg-ok")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
