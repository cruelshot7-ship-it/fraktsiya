/**
 * Правила отправки уведомлений через бота. Чистые функции: без сети, без базы.
 * Отвечают на два вопроса: кому можно писать и что в сообщении может быть.
 */

export const ALLOWED_KINDS = ["booking_confirmed", "booking_cancelled"] as const;
export type AllowedKind = (typeof ALLOWED_KINDS)[number];

/** Совпадает с TelegramSession из telegram-auth.server.ts (сервер передаёт сюда только нужные поля). */
export type Session = { role: "trainer" | "client"; user: { id: string } };

export type EventInput = {
  id: string;
  kind: string;
  telegramId: string;
  payload?: Record<string, unknown>;
};

export type Safe = { bookingId: string; clientId: string; date: string; time: string };

export type Prepared =
  | { ok: true; kind: AllowedKind; text: string; payload: Safe }
  | { ok: false; error: "kind_not_allowed" | "forbidden" | "bad_payload" };

const ID_RE = /^[\w:.-]{1,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function isAllowedKind(kind: string): kind is AllowedKind {
  return (ALLOWED_KINDS as readonly string[]).includes(kind);
}

/** Тренер пишет любому клиенту. Клиент пишет только себе. */
export function canSend(session: Session, telegramId: string): boolean {
  if (session.role === "trainer") return true;
  return telegramId === session.user.id;
}

/** Оставляем только поля шаблона. Всё остальное отбрасываем и в базу не пишем. */
export function sanitizePayload(payload: Record<string, unknown>): Safe | null {
  const bookingId = typeof payload.bookingId === "string" ? payload.bookingId : "";
  const clientId = typeof payload.clientId === "string" ? payload.clientId : "";
  if (!ID_RE.test(bookingId) || !ID_RE.test(clientId)) return null;
  const date = typeof payload.date === "string" && DATE_RE.test(payload.date) ? payload.date : "";
  const time = typeof payload.time === "string" && TIME_RE.test(payload.time) ? payload.time : "";
  return { bookingId, clientId, date, time };
}

/** Текст только из шаблонов. Свободного текста от клиента нет. */
export function buildText(kind: AllowedKind, p: Safe): string {
  if (kind === "booking_cancelled") return "Запись отменена.";
  return p.date && p.time ? `Запись подтверждена: ${p.date} · ${p.time}` : "Запись подтверждена.";
}

export function prepareEvent(session: Session, e: EventInput): Prepared {
  if (!isAllowedKind(e.kind)) return { ok: false, error: "kind_not_allowed" };
  if (!canSend(session, e.telegramId)) return { ok: false, error: "forbidden" };
  const payload = sanitizePayload(e.payload ?? {});
  if (!payload) return { ok: false, error: "bad_payload" };
  return { ok: true, kind: e.kind, text: buildText(e.kind, payload), payload };
}
