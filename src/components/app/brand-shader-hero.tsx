import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";
import { isShaderBgEnabled } from "@/lib/shader-bg-flag";
import { cn } from "@/lib/utils";

/**
 * Firm brand hero WebGL gradient (shadergradient).
 * - Only for welcome / offer landing, not under training forms.
 * - pointer-events: none so CTAs and scroll stay usable.
 * - Pauses when document is hidden or prefers-reduced-motion.
 * - Static CSS fallback while loading / on error / when disabled.
 */

const FALLBACK_STYLE: CSSProperties = {
  background:
    "radial-gradient(120% 80% at 20% 0%, rgb(196 176 138 / 0.28), transparent 55%)," +
    "radial-gradient(100% 70% at 90% 10%, rgb(178 59 46 / 0.22), transparent 50%)," +
    "linear-gradient(165deg, #1a1512 0%, #0f0d0c 45%, #16110e 100%)",
};

function StaticFallback({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
      style={FALLBACK_STYLE}
    />
  );
}

const ShaderCanvas = lazy(() =>
  import("./brand-shader-canvas").then((m) => ({ default: m.BrandShaderCanvas })),
);

type Props = {
  className?: string;
  /** When false, only static CSS (e.g. step "time" form). */
  active?: boolean;
};

export function BrandShaderHero({ className, active = true }: Props) {
  const [allowed, setAllowed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isShaderBgEnabled() || !active) return;
    setAllowed(true);
  }, [active]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVis = () => setVisible(document.visibilityState === "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!active || !isShaderBgEnabled() || reduced || failed) {
    return <StaticFallback className={className} />;
  }

  if (!allowed) {
    return <StaticFallback className={className} />;
  }

  if (!visible) {
    return <StaticFallback className={className} />;
  }

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <StaticFallback />
      <Suspense fallback={null}>
        <div className="absolute inset-0 opacity-90">
          <ShaderCanvas onError={() => setFailed(true)} />
        </div>
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgb(12 10 9 / 0.35) 0%, rgb(12 10 9 / 0.55) 55%, rgb(12 10 9 / 0.75) 100%)",
          }}
        />
      </Suspense>
    </div>
  );
}
