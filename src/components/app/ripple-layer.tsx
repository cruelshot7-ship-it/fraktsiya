import { useEffect } from "react";

const TARGET = "button, [role='button'], a[href], .pressable";

/**
 * Волна от точки касания на любой активной кнопке. Вибрацию даёт HapticLayer;
 * здесь только движение. Отключается при «уменьшении движения» и у элементов с data-no-ripple.
 */
export function RippleLayer() {
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const down = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(TARGET) : null;
      if (!target || target.closest("[data-no-ripple]") || (target as HTMLButtonElement).disabled) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const dot = document.createElement("span");
      dot.className = "ripple-dot";
      dot.style.width = `${size}px`;
      dot.style.height = `${size}px`;
      dot.style.left = `${event.clientX - rect.left - size / 2}px`;
      dot.style.top = `${event.clientY - rect.top - size / 2}px`;
      target.classList.add("ripple-host");
      target.appendChild(dot);
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    };
    window.addEventListener("pointerdown", down, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", down, true);
  }, []);

  return null;
}
