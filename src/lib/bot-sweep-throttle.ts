/**
 * Чистку сообщений бота не нужно делать при каждом обновлении приложения (раз в 12 секунд у каждого открытого).
 * Cron (`/api/bot-sweep`) делает её в любом случае; здесь — попутная уборка не чаще `everyMs`.
 */
export function sweepDue(now: number, lastSweepAt: number, everyMs: number): boolean {
  return now - lastSweepAt >= everyMs;
}
