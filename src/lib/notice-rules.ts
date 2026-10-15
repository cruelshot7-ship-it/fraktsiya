/**
 * Одноразовый показ уведомлений клиенту: правила без БД и сети. Тесты — notice-rules.test.ts.
 *
 * Текст уведомления не уходит в чат. В чат приходит короткая кнопка, текст открывается в приложении
 * один раз: после открытия он стирается, а повторное открытие ничего не показывает.
 */

/** Срок, после которого неоткрытое уведомление удаляется вместе с текстом. */
export const NOTICE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type NoticeRow = {
  id: number;
  telegramId: string;
  expiresAt: Date;
  openedAt: Date | null;
};

/**
 * open — можно показать и стереть; opened — уже открывали; expired — срок вышел;
 * missing — нет такого уведомления или оно не для этого пользователя (не различаем, чтобы не подсказывать id).
 */
export type OpenVerdict = "open" | "opened" | "expired" | "missing";

export function noticeExpiry(now: Date): Date {
  return new Date(now.getTime() + NOTICE_TTL_MS);
}

export function openVerdict(row: NoticeRow | null, userTelegramId: string, now: Date): OpenVerdict {
  if (!row || row.telegramId !== String(userTelegramId)) return "missing";
  if (row.openedAt !== null) return "opened";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "open";
}

/** Параметр запуска Mini App для уведомления: n_<id>. */
export function noticeStartParam(id: number): string {
  return `n_${id}`;
}

/** Разбор параметра запуска. Не наш параметр — null. */
export function parseNoticeParam(raw: string): number | null {
  const match = /^n_(\d{1,12})$/i.exec(raw.trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
