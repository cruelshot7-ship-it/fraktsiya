/**
 * Правила отправки уведомлений через бота. Чистые функции: без сервера, поэтому покрыты тестами.
 * Бот пишет только тем, кому разрешено: тренеру — любому, клиенту — только себе.
 */
export const NOTIFY_KINDS = ["booking_confirmed", "booking_cancelled", "attendance", "progression_decided", "generic"] as const;

export type FlushEvent = { id: string; kind: string; telegramId: string; payload?: Record<string, unknown> };
export type FlushSession = { role: "trainer" | "client"; userId: string } | null;
export type FlushCheck = { ok: true; text: string } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Текст строится только из проверенных полей: дата и время по формату, без произвольных строк. */
export function messageText(kind: string, payload: Record<string, unknown> = {}): string {
  const date = typeof payload.date === "string" && DATE_RE.test(payload.date) ? payload.date : "";
  const time = typeof payload.time === "string" && TIME_RE.test(payload.time) ? payload.time : "";
  if (kind === "booking_confirmed") return date && time ? `Запись подтверждена: ${date} · ${time}` : "Запись подтверждена.";
  if (kind === "booking_cancelled") return "Запись отменена.";
  if (kind === "attendance") return "Отметка посещения в зале.";
  if (kind === "progression_decided") return "Тренер обновил программу.";
  return "Новое уведомление из зала.";
}

export function checkFlushEvent(event: FlushEvent, session: FlushSession): FlushCheck {
  if (!session) return { ok: false, error: "not-allowed" };
  if (session.role !== "trainer" && event.telegramId !== session.userId) return { ok: false, error: "forbidden" };
  if (!/^\d{1,20}$/.test(event.telegramId)) return { ok: false, error: "recipient" };
  if (!(NOTIFY_KINDS as readonly string[]).includes(event.kind)) return { ok: false, error: "kind" };
  return { ok: true, text: messageText(event.kind, event.payload) };
}
