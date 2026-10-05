import { useEffect, useState, type ReactNode } from "react";
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
        "apple-block p-4",
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
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "alert"
            ? "bg-primary shadow-[0_0_12px_rgb(221_51_42_/0.35)]"
            : "bg-ok shadow-[0_0_12px_rgb(69_212_228_/0.35)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function KbjuMacroRing({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const max = safeTarget > 0 ? safeTarget : Math.max(safeCurrent, 1);
  const ratio = Math.min(1, Math.max(0, safeCurrent / max));
  const over = safeTarget > 0 && safeCurrent > safeTarget * 1.05;

  const [shown, setShown] = useState(0);
  useEffect(() => {
    let from = 0;
    setShown((prev) => {
      from = prev;
      return prev;
    });
    const to = Math.round(safeCurrent);
    const start = performance.now();
    const dur = 520;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (to - from) * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safeCurrent]);

  const r = 18;
  const c = 2 * Math.PI * r;
  // In progress → primary (red); full (≥100%) → ok (cyan); over → primary alert
  const complete = safeTarget > 0 ? ratio >= 1 : safeCurrent > 0 && ratio >= 1;
  const stroke = over
    ? "var(--color-primary)"
    : complete
      ? "var(--color-ok)"
      : "var(--color-primary)";
  const glow = over
    ? "0 0 14px rgb(221 51 42 / 0.4)"
    : complete
      ? "0 0 14px rgb(69 212 228 / 0.4)"
      : ratio > 0
        ? "0 0 10px rgb(221 51 42 / 0.22)"
        : "none";

  return (
    <button
      type="button"
      className="pressable flex flex-col items-center gap-1 rounded-xl px-1 py-1"
      aria-label={`${label}: ${Math.round(safeCurrent)}${safeTarget > 0 ? ` из ${Math.round(safeTarget)}` : ""}`}
    >
      <div className="relative size-[3.25rem]">
        <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3.5"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 700ms cubic-bezier(0.32, 0.72, 0, 1), stroke 350ms ease, filter 350ms ease",
              filter: glow !== "none" ? `drop-shadow(${glow})` : undefined,
            }}
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span
            className={cn(
              "font-display text-sm tabular-nums leading-none",
              complete && !over ? "text-ok" : over ? "text-primary" : "text-foreground",
            )}
          >
            {shown}
          </span>
        </span>
      </div>
      {safeTarget > 0 ? (
        <span className="text-3xs tabular-nums text-muted-foreground">/{Math.round(safeTarget)}</span>
      ) : (
        <span className="text-3xs text-muted-foreground">факт</span>
      )}
      <span className="text-2xs tracking-wide text-muted-foreground uppercase">{label}</span>
    </button>
  );
}

export function KbjuMeters({
  eaten,
  target,
  title,
}: {
  eaten: { calories: number; protein: number; fat: number; carbs: number };
  target: { calories: number; protein: number; fat: number; carbs: number };
  title?: string;
}) {
  const hasGoal = target.calories > 0;
  const low = hasGoal && eaten.calories > 0 && eaten.calories < target.calories * 0.72;
  const over = hasGoal && eaten.calories > target.calories * 1.08;
  return (
    <div>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <div className={title ? "mt-3" : undefined}>
        <ProgressRail
          value={eaten.calories}
          max={hasGoal ? target.calories : Math.max(eaten.calories, 1)}
          tone={low || over ? "alert" : "ok"}
        />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1">
        <KbjuMacroRing label="ккал" current={eaten.calories} target={target.calories} />
        <KbjuMacroRing label="Б" current={eaten.protein} target={target.protein} />
        <KbjuMacroRing label="Ж" current={eaten.fat} target={target.fat} />
        <KbjuMacroRing label="У" current={eaten.carbs} target={target.carbs} />
      </div>
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="px-1 py-10 text-center text-sm leading-relaxed text-muted-foreground">{children}</p>;
}
