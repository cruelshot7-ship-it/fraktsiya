/**
 * Хранение одноразовых уведомлений клиентам. Только сервер. Правила — notice-rules.ts.
 * Открытие атомарно: текст получает только тот запрос, который первым выставил opened_at.
 */
import { noticeExpiry, openVerdict, type NoticeRow, type OpenVerdict } from "@/lib/notice-rules";

async function getSql() {
  const db = await import("@/lib/db");
  return db.getSql();
}

/** Сохраняет текст до открытия. null — не сохранено; тогда текст в чат не отправляем. */
export async function createClientNotice(telegramId: string, body: string, now = new Date()): Promise<number | null> {
  try {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      insert into client_notices (telegram_id, body, expires_at)
      values (${telegramId}, ${body}, ${noticeExpiry(now).toISOString()})
      returning id`;
    const id = Number(rows[0]?.id);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  } catch (err) {
    console.error("[client-notice] store failed", err);
    return null;
  }
}

export async function setNoticeChatMessage(id: number, messageId: number): Promise<void> {
  try {
    const sql = await getSql();
    await sql`update client_notices set chat_message_id = ${messageId} where id = ${id}`;
  } catch (err) {
    console.error("[client-notice] message link failed", err);
  }
}

export type OpenResult =
  | { verdict: Exclude<OpenVerdict, "open"> }
  | { verdict: "open"; body: string; chatMessageId: number | null };

/** Открывает уведомление для пользователя. Текст стирается сразу после выдачи. */
export async function openClientNotice(id: number, telegramId: string, now = new Date()): Promise<OpenResult> {
  const sql = await getSql();
  const found = await sql<{ id: string; telegram_id: string; expires_at: Date | string; opened_at: Date | string | null }>`
    select id, telegram_id, expires_at, opened_at from client_notices where id = ${id}`;
  const r = found[0];
  const row: NoticeRow | null = r
    ? {
        id: Number(r.id),
        telegramId: r.telegram_id,
        expiresAt: new Date(r.expires_at),
        openedAt: r.opened_at ? new Date(r.opened_at) : null,
      }
    : null;
  const verdict = openVerdict(row, telegramId, now);
  if (verdict !== "open") return { verdict };

  // claim: только один запрос выставит opened_at и получит строку
  const claimed = await sql<{ body: string; chat_message_id: string | null }>`
    update client_notices set opened_at = ${now.toISOString()}
     where id = ${id} and opened_at is null and expires_at > ${now.toISOString()}
    returning body, chat_message_id`;
  const c = claimed[0];
  if (!c) return { verdict: "opened" };

  await sql`update client_notices set body = '' where id = ${id}`;
  const chatMessageId = c.chat_message_id === null ? null : Number(c.chat_message_id);
  return { verdict: "open", body: c.body, chatMessageId };
}

/** Удаляет истёкшие уведомления вместе с текстом. Вызывается из ежедневной уборки. */
export async function purgeExpiredNotices(now = new Date()): Promise<number> {
  try {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`delete from client_notices where expires_at < ${now.toISOString()} returning id`;
    return rows.length;
  } catch (err) {
    console.error("[client-notice] purge failed", err);
    return 0;
  }
}
