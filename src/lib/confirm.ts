import { getTelegram } from "@/lib/telegram";

/**
 * A yes/no question. Inside Telegram it is Telegram's own dialog (no browser box in the Mini App);
 * elsewhere, the browser dialog. Resolves false when neither is available.
 */
export function confirmAction(message: string): Promise<boolean> {
  const tg = getTelegram();
  if (tg?.showConfirm) {
    return new Promise((resolve) => tg.showConfirm?.(message, (ok) => resolve(Boolean(ok))));
  }
  if (typeof window === "undefined") return Promise.resolve(false);
  return Promise.resolve(window.confirm(message));
}
