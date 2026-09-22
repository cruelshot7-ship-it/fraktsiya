export type HapticStyle = "light" | "medium" | "heavy" | "rigid" | "soft";
export type HapticNotify = "error" | "success" | "warning";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
};

export type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  platform?: string;
  isExpanded?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser; start_param?: string };
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: HapticStyle) => void;
    notificationOccurred: (type: HapticNotify) => void;
    selectionChanged: () => void;
  };
  showScanQrPopup?: (params: { text?: string }, cb: (text: string) => void) => void;
  closeScanQrPopup?: () => void;
};

export function getTelegram(): TelegramWebApp | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export function getTelegramUser(): TelegramUser | undefined {
  return getTelegram()?.initDataUnsafe?.user;
}

export function getTelegramInitData(): string {
  return getTelegram()?.initData ?? "";
}

export function getStartParam(): string {
  const fromTg = getTelegram()?.initDataUnsafe?.start_param?.trim();
  if (fromTg) return fromTg;
  if (typeof window === "undefined") return "";
  try {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, "").replace(/^tgWebAppData=/, ""));
    return (query.get("startapp") || query.get("start_param") || hash.get("startapp") || "").trim();
  } catch {
    return "";
  }
}

export function inviteUrl(botUsername: string | null | undefined, code: string) {
  const bot = (botUsername ?? "").replace(/^@/, "").trim() || "ruksha_discipline_bot";
  return `https://t.me/${bot}?startapp=${encodeURIComponent(code)}`;
}

export function openTelegramUrl(url: string) {
  const tg = getTelegram();
  if (url.startsWith("https://t.me/") && tg?.openTelegramLink) {
    tg.openTelegramLink(url);
    return;
  }
  if (tg?.openLink) {
    tg.openLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openTrainerChat(username: string | null | undefined) {
  const handle = (username ?? "").replace(/^@/, "").trim() || "ruksha_discipline_bot";
  openTelegramUrl(`https://t.me/${handle}`);
  return true;
}

export function openPhone(phone: string | null | undefined) {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return false;
  const e164 =
    d.length === 11 && d.startsWith("8") ? `7${d.slice(1)}` : d.length === 10 ? `7${d}` : d;
  const url = `tel:+${e164}`;
  const tg = getTelegram();
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_self");
  return true;
}

function bindVisualViewport() {
  if (typeof window === "undefined") return;
  const apply = () => {
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const offset = vv ? vv.offsetTop : 0;
    const keyboard = Math.max(0, window.innerHeight - height - offset);
    const root = document.documentElement;
    root.style.setProperty("--vv-height", `${Math.round(height)}px`);
    root.style.setProperty("--vv-offset", `${Math.round(offset)}px`);
    root.style.setProperty("--keyboard", `${Math.round(keyboard)}px`);
    if (!getTelegram()?.viewportStableHeight) {
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
    }
  };
  apply();
  window.visualViewport?.addEventListener("resize", apply, { passive: true });
  window.visualViewport?.addEventListener("scroll", apply, { passive: true });
  window.addEventListener("orientationchange", () => window.setTimeout(apply, 250), { passive: true });
}

export function initTelegram() {
  bindVisualViewport();
  const tg = getTelegram();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.("#141310");
    tg.setBackgroundColor?.("#141310");
    tg.disableVerticalSwipes?.();
    const apply = () => {
      const h = tg.viewportStableHeight || tg.viewportHeight;
      if (h) document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
    };
    apply();
    tg.onEvent?.("viewportChanged", apply);
  } catch {
    /* older Telegram WebViews omit some methods */
  }
}
