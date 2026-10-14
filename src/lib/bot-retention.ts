/**
 * Правила автоудаления уведомлений бота. Чистые функции: без БД и сети.
 * Уведомление живёт сутки с момента отправки. Telegram разрешает боту удалить своё сообщение
 * в личном чате в течение 48 часов, поэтому 24 часа укладываются в это окно.
 */

export const BOT_MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Сколько раз пытаться удалить сообщение при временных сбоях, прежде чем закрыть запись. */
export const MAX_DELETE_ATTEMPTS = 5;

export function deleteAfter(sentAt: Date): Date {
  return new Date(sentAt.getTime() + BOT_MESSAGE_TTL_MS);
}

export function isDue(row: { deleteAfter: Date; deletedAt: Date | null }, now: Date): boolean {
  return row.deletedAt === null && row.deleteAfter.getTime() <= now.getTime();
}

/** Ответ Telegram на deleteMessage, приведённый к нужному виду. */
export type DeleteOutcome = { ok: boolean; description?: string; errorCode?: number };

/**
 * done — сообщение удалено или его уже нет;
 * retry — временный сбой (сеть, 429, 5xx), попробуем на следующем проходе;
 * give_up — постоянный отказ, запись закрывается с причиной.
 */
export type DeleteVerdict = "done" | "retry" | "give_up";

export function deleteVerdict(outcome: DeleteOutcome, attempts: number): DeleteVerdict {
  if (outcome.ok) return "done";
  const description = (outcome.description ?? "").toLowerCase();
  if (description.includes("not found")) return "done";
  const transient = outcome.errorCode === undefined || outcome.errorCode === 429 || outcome.errorCode >= 500;
  if (transient && attempts + 1 < MAX_DELETE_ATTEMPTS) return "retry";
  return "give_up";
}
