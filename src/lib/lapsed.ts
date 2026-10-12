/**
 * Ушедшие клиенты: давно без занятий и без записи вперёд. Признак вычисляется, ничего не хранится
 * и ничего не отправляется. Чистая логика, без I/O.
 */
import { daysUntil } from "@/lib/balance-summary";

export const LAPSED_DAYS = 60;

/** Последняя дата активности: визит или, если визитов не было, старт программы. */
export function lastActivityDate(visitDates: string[], programStart?: string | null): string | null {
  let last: string | null = null;
  for (const d of visitDates) if (!last || d > last) last = d;
  if (!last && programStart) return programStart;
  return last;
}

export function isLapsed(opts: {
  erased?: boolean;
  lastActivity: string | null;
  hasUpcoming: boolean;
  today: string;
}): boolean {
  if (opts.erased || opts.hasUpcoming || !opts.lastActivity) return false;
  return daysUntil(opts.lastActivity, opts.today) <= -LAPSED_DAYS;
}
