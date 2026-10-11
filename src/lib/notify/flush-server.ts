/**
 * Server: durable outbox on Neon + Telegram Bot delivery (best-effort).
 * Доступ только по проверенной сессии Telegram; правила адресатов — в flush-rules.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  initData: z.string().optional(),
  events: z
    .array(
      z.object({
        id: z.string(),
        kind: z.string(),
        telegramId: z.string(),
        payload: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(20),
});

export type FlushResult = {
  results: { id: string; ok: boolean; error?: string }[];
  durable: boolean;
};

export const flushOutboxServerFn = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }): Promise<FlushResult> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const { checkFlushEvent } = await import("@/lib/notify/flush-rules");
    const { sendBotLink } = await import("@/lib/telegram-bot.server");
    const auth = verifyTelegramInitData(data.initData);
    const session = auth ? { role: auth.role, userId: auth.user.id } : null;

    const results: FlushResult["results"] = [];
    let durable = false;

    let sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>> | null = null;
    try {
      const { getSql, getDbSource } = await import("@/lib/db");
      if (getDbSource() === "neon") {
        sql = await getSql();
        durable = true;
      }
    } catch {
      sql = null;
    }

    for (const e of data.events) {
      const check = checkFlushEvent({ ...e, payload: e.payload ?? {} }, session);
      if (!check.ok) {
        results.push({ id: e.id, ok: false, error: check.error });
        continue;
      }
      if (sql) {
        try {
          await sql.query(
            `insert into notify_outbox (id, kind, telegram_id, payload, status, attempts)
             values ($1, $2, $3, $4::jsonb, 'pending', 0)
             on conflict (id) do update set
               payload = excluded.payload,
               updated_at = now()`,
            [e.id, e.kind, e.telegramId, JSON.stringify(e.payload ?? {})],
          );
        } catch (err) {
          console.error("[outbox] persist failed", err);
          durable = false;
        }
      }

      try {
        const r = await sendBotLink(e.telegramId, check.text);
        const ok = Boolean(r && (r as { ok?: boolean }).ok !== false);
        const error = (r as { description?: string })?.description;
        results.push({ id: e.id, ok, error });
        if (sql) {
          try {
            await sql.query(
              `update notify_outbox
               set status = $2, attempts = attempts + 1,
                   last_error = $3, updated_at = now()
               where id = $1`,
              [e.id, ok ? "sent" : "failed", error ?? null],
            );
          } catch {
            /* ignore mark errors */
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({ id: e.id, ok: false, error });
        if (sql) {
          try {
            await sql.query(
              `update notify_outbox
               set status = 'failed', attempts = attempts + 1,
                   last_error = $2, updated_at = now()
               where id = $1`,
              [e.id, error],
            );
          } catch {
            /* ignore */
          }
        }
      }
    }
    return { results, durable };
  });
