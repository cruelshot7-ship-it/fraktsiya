import { useEffect, useRef } from "react";
import { hapticImpact, hapticSelection, isHapticTarget } from "@/lib/haptics";

export function HapticLayer() {
  const lastAt = useRef(0);

  useEffect(() => {
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const now = performance.now();
      if (now - lastAt.current < 40) return;
      lastAt.current = now;
      if (!isHapticTarget(event.target)) return;
      const host = event.target instanceof Element ? event.target.closest("button, [role='button']") : null;
      if (host) hapticSelection();
      else hapticImpact(event.pointerType === "touch" ? "soft" : "light");
    };
    window.addEventListener("pointerdown", down, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", down, true);
  }, []);

  return null;
}
