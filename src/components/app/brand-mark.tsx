import { cn } from "@/lib/utils";
import { STUDIO } from "@/data/studio";

export function MonogramSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none">
      <defs>
        <linearGradient id="ruksha-steel" x1="8" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f4f1ea" />
          <stop offset="0.28" stopColor="#c8c3b8" />
          <stop offset="0.52" stopColor="#8a867c" />
          <stop offset="0.74" stopColor="#e4dfd4" />
          <stop offset="1" stopColor="#6f6b62" />
        </linearGradient>
      </defs>
      <path
        fill="url(#ruksha-steel)"
        d="M10 8h22v8H20v8h14.5c9.2 0 15.5 5.4 15.5 14.2 0 6.2-3.4 11-9.2 13.2L52 56H40.6L32.8 44H20v12H10V8Zm10 24v8h13.2c3.8 0 6-1.8 6-4.2s-2.2-3.8-6-3.8H20Z"
      />
    </svg>
  );
}

export function BrandMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("relative isolate inline-grid shrink-0 place-items-center bg-background shadow-[inset_0_1px_0_rgb(236_231_220_/_0.12)]", className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.22) }}
      aria-hidden
    >
      <MonogramSvg className="h-[70%] w-[70%]" />
    </span>
  );
}

export function BrandLockup({ compact }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <BrandMark size={compact ? 28 : 40} />
      <div className="min-w-0">
        <p className="font-display leading-none tracking-[0.22em] text-foreground uppercase" style={{ fontSize: compact ? "0.7rem" : "0.92rem" }}>
          {STUDIO.name}
        </p>
        <p className="mt-1 truncate text-3xs tracking-[0.16em] text-muted-foreground uppercase">
          {STUDIO.line} · {STUDIO.est}
        </p>
      </div>
    </div>
  );
}
