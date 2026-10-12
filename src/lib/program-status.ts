/**
 * Где клиент в программе: номер недели и признак, что программа уже прошла все недели.
 * Pure: без импортов, проверяется node --test.
 *
 * diffDays — сколько полных дней прошло от старта программы до даты (может быть отрицательным,
 * если старт в будущем). Неделя 1 — первые 7 дней, дальше каждые 7 дней — следующая.
 */
export function programProgress(diffDays: number, weeks: number): { week: number; finished: boolean } {
  const total = Math.max(1, Math.floor(weeks) || 1);
  const raw = Math.max(1, Math.floor(diffDays / 7) + 1);
  return { week: Math.min(total, raw), finished: raw > total };
}
