import { getTelegram, type HapticNotify, type HapticStyle } from "@/lib/telegram";

const IMPACT_MS: Record<HapticStyle, number> = {
  light: 10,
  soft: 12,
  medium: 18,
  rigid: 16,
  heavy: 28,
};

function canVibrate() {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function hapticImpact(style: HapticStyle = "light") {
  try {
    const haptic = getTelegram()?.HapticFeedback;
    if (haptic?.impactOccurred) {
      haptic.impactOccurred(style);
      return;
    }
    if (canVibrate()) navigator.vibrate(IMPACT_MS[style]);
  } catch {
    /* iOS Safari / denied vibrate — silent */
  }
}

export function hapticSelection() {
  try {
    const haptic = getTelegram()?.HapticFeedback;
    if (haptic?.selectionChanged) {
      haptic.selectionChanged();
      return;
    }
    if (canVibrate()) navigator.vibrate(8);
  } catch {
    /* no-op */
  }
}

export function hapticNotify(type: HapticNotify = "success") {
  try {
    const haptic = getTelegram()?.HapticFeedback;
    if (haptic?.notificationOccurred) {
      haptic.notificationOccurred(type);
      return;
    }
    if (!canVibrate()) return;
    if (type === "success") navigator.vibrate([12, 30, 18]);
    else if (type === "warning") navigator.vibrate([20, 40, 20]);
    else navigator.vibrate([30, 40, 40]);
  } catch {
    /* no-op */
  }
}

const INTERACTIVE = "button, [role='button'], a[href], .pressable, [data-haptic], summary";
const SKIP = "input, textarea, select, option, [data-no-haptic]";

export function isHapticTarget(node: EventTarget | null): boolean {
  if (!(node instanceof Element)) return false;
  if (node.closest(SKIP)) return false;
  return Boolean(node.closest(INTERACTIVE));
}
