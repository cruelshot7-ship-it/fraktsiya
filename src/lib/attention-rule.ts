/**
 * Правило «Внимания» тренера. Внимание только по двум причинам:
 * - осталось 2 занятия или меньше (включая 0);
 * - клиент без тренировок дольше NO_TRAINING_DAYS дней.
 * Клиент на заморозке в «Внимание» не попадает.
 * Остальные сигналы (отчёт, калории, отмены, срок пакета) показываются на карточке нейтрально.
 */
export const LOW_SESSIONS_MAX = 2;
export const NO_TRAINING_DAYS = 14;

export function isLowSessions(sessionsLeft: number | null | undefined): boolean {
  return (sessionsLeft ?? 0) <= LOW_SESSIONS_MAX;
}

export function isNoTraining(daysSinceActivity: number): boolean {
  return daysSinceActivity > NO_TRAINING_DAYS;
}

/** Отложено тренером: «Внимание» не показывает клиента до конца дня даты отсрочки включительно. */
export function isSnoozed(snoozeUntil: string | null | undefined, today: string): boolean {
  return Boolean(snoozeUntil && snoozeUntil >= today);
}

export function needsAttention(input: {
  sessionsLeft: number | null | undefined;
  daysSinceActivity: number;
  frozen: boolean;
}): boolean {
  if (input.frozen) return false;
  return isLowSessions(input.sessionsLeft) || isNoTraining(input.daysSinceActivity);
}
