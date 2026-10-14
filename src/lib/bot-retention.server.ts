/**
 * Журнал и уборка уведомлений бота. Правила (сроки, повторы, вердикты) — в bot-retention.ts.
 *
 * Что пишем: только идентификаторы (чат, номер сообщения, вид, сроки). Текст уведомления не хранится.
 * Где пишем: только в Neon (durable). В предпросмотре (PGLite) журнал не ведём: строки там
 * пропали бы при перезапуске, а удалить сообщение было бы некому.
 *
 * Уборка запускается из двух мест: ежедневный cron (/api/bot-sweep) и попутно из sendDueReminders,
 * которая вызывается на каждом открытии приложения и на каждом апдейте бота. Попутный вызов нужен,
 * потому что Telegram не даёт боту удалять сообщения старше 48 часов, а ежедневный cron может опоздать.
 */
import type { Sql } from "@/lib/db-adapters";
import { deleteAfter, deleteVerdict, type DeleteOutcome } from "@/lib/bot-retention";

export type BotMessageKind = "notify" | "reminder" | "digest";

async function durableSql(): Promise<Sql | null> {
  const { getSql, getDbSource } = await import("@/lib/db");
  if (getDbSource() !== "neon") return null;
  return getSql();
}

/** Номер сообщения из ответа Telegram sendMessage/sendDocument; без него записывать нечего. */
export function messageIdOf(res: unknown): number | undefined {
  const id = (res as { result?: { message_id?: unknown } } | undefined)?.result?.message_id;
  return typeof id === "number" ? id : undefined;
}

/** Запоминает отправленное уведомление. Сбой записи не должен сломать отправку. */
export async function recordBotMessage(chatId: string | number, messageId: number | undefined, kind: BotMessageKind, sentAt = new Date()) {
  if (!messageId) return;
  try {
    const sql = await durableSql();
    if (!sql) return;
    await sql.query(
      `insert into bot_messages (chat_id, message_id, kind, sent_at, delete_after)
       values ($1, $2, $3, $4, $5)
       on conflict (chat_id, message_id) do nothing`,
      [String(chatId), messageId, kind, sentAt.toISOString(), deleteAfter(sentAt).toISOString()],
    );
  } catch (err) {
    console.error("[bot-retention] record failed", kind, err);
  }
}

/** Закрывает запись, если сообщение удалено раньше срока (например, ответом на кнопку напоминания). */
export async function closeBotMessage(chatId: string | number, messageId: number, now = new Date()) {
  try {
    const sql = await durableSql();
    if (!sql) return;
    await sql.query(
      `update bot_messages set deleted_at = $3
        where chat_id = $1 and message_id = $2 and deleted_at is null`,
      [String(chatId), messageId, now.toISOString()],
    );
  } catch (err) {
    console.error("[bot-retention] close failed", err);
  }
}

async function deleteInTelegram(chatId: string, messageId: number): Promise<DeleteOutcome> {
  const { env } = await import("@/lib/env.server");
  const tok = env("BOT_TOKEN");
  if (!tok) return { ok: false, description: "no-token" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${tok}/deleteMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    const body = (await res.json()) as { ok?: boolean; description?: string; error_code?: number };
    return {
      ok: body.ok === true,
      description: body.description,
      errorCode: body.error_code ?? (res.ok ? undefined : res.status),
    };
  } catch (err) {
    // сеть или не-JSON ответ: без кода ошибки, значит временный сбой
    return { ok: false, description: err instanceof Error ? err.message : "network" };
  }
}

export type SweepResult = { checked: number; closed: number };

/**
 * Удаляет уведомления, у которых прошли сутки. Строка закрывается (deleted_at), когда сообщение
 * удалено, его уже нет или отказ постоянный. При временном сбое строка остаётся с новой попыткой.
 * Повторный запуск безопасен: уже закрытые строки не выбираются, а «не найдено» считается готовым.
 */
export async function sweepBotMessages(now = new Date(), limit = 10): Promise<SweepResult> {
  let db: Sql | null;
  try {
    db = await durableSql();
  } catch {
    return { checked: 0, closed: 0 };
  }
  if (!db) return { checked: 0, closed: 0 };
  const sql: Sql = db;

  const rows = await sql.query<{ id: string; chat_id: string; message_id: string; attempts: number }>(
    `select id, chat_id, message_id, attempts
       from bot_messages
      where deleted_at is null and delete_after <= $1
      order by delete_after
      limit $2`,
    [now.toISOString(), limit],
  );

  const results = await Promise.all(
    rows.map(async (row) => {
      const outcome = await deleteInTelegram(row.chat_id, Number(row.message_id));
      const verdict = deleteVerdict(outcome, row.attempts);
      const reason = outcome.ok ? null : (outcome.description ?? null);
      if (verdict === "retry") {
        await sql.query(
          `update bot_messages set attempts = attempts + 1, last_error = $2 where id = $1`,
          [row.id, reason],
        );
        return false;
      }
      // done и give_up закрывают строку; причину постоянного отказа видно в last_error
      await sql.query(
        `update bot_messages set deleted_at = $2, attempts = attempts + 1, last_error = $3 where id = $1`,
        [row.id, now.toISOString(), reason],
      );
      return true;
    }),
  );

  return { checked: rows.length, closed: results.filter(Boolean).length };
}
