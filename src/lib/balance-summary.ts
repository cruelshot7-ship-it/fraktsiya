/**
 * Сводка занятий по клиентам для экрана тренера. Считает занятия, не деньги:
 * цен и оплат в данных пока нет (см. раздел «Деньги» в PR).
 * Чистая функция, без импортов.
 */

export type BalanceClient = { sessionsLeft?: number | null; packExpiresAt?: string | null };

export type BalanceSummary = {
  /** занятий оплачено наперёд, сумма остатков */
  prepaid: number;
  /** клиентов с нулевым остатком */
  empty: number;
  /** клиентов с остатком 1–2 занятия */
  low: number;
  /** клиентов с непустым пакетом, у которого срок заканчивается в ближайшие 7 дней */
  packsEndingSoon: number;
};

export const PACK_SOON_DAYS = 7;

/** Дней от today до iso (оба YYYY-MM-DD). Отрицательно — срок прошёл. */
export function daysUntil(iso: string, today: string): number {
  const a = Date.parse(`${iso}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((a - b) / 86400000);
}

export function balanceSummary(clients: BalanceClient[], today: string): BalanceSummary {
  let prepaid = 0;
  let empty = 0;
  let low = 0;
  let packsEndingSoon = 0;
  for (const c of clients) {
    const left = Math.max(0, c.sessionsLeft ?? 0);
    prepaid += left;
    if (isEmptyClient(c)) empty += 1;
    else if (left <= 2) low += 1;
    if (isPackSoon(c, today)) packsEndingSoon += 1;
  }
  return { prepaid, empty, low, packsEndingSoon };
}

/** Клиент без занятий на балансе (остаток 0). Тот же критерий, что счётчик «Без занятий». */
export function isEmptyClient(c: BalanceClient): boolean {
  return Math.max(0, c.sessionsLeft ?? 0) === 0;
}

/** Клиент с непустым пакетом, у которого срок заканчивается в ближайшие 7 дней. Тот же критерий, что счётчик. */
export function isPackSoon(c: BalanceClient, today: string): boolean {
  if (Math.max(0, c.sessionsLeft ?? 0) === 0 || !c.packExpiresAt) return false;
  const days = daysUntil(c.packExpiresAt, today);
  return days >= 0 && days <= PACK_SOON_DAYS;
}
