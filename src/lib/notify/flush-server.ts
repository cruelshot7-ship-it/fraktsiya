/**
 * Server: durable outbox on Neon + Telegram Bot delivery (best-effort).
 * Вызов без подписанного initData отклоняется. Кому и что можно отправить — в flush-rules.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { prepareEvent } from "@/lib/notify/flush-rules";

const Input = z.object({
  initData: z.string().max(4096),
  events: z
    .array(
      z.object({
        id: z.string().max(200),
        kind: z.string().max(64),
        telegramId: z.string().max(32),
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
    const session = verifyTelegramInitData(data.initData);
    if (!session) {
      return {
        results: data.events.map((e) => ({ id: e.id, ok: false, error: "unauthorized" })),
        durable: false,
      };
    }

    const { sendBotLink } = await import("@/lib/telegram-bot.server");
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
      const prep = prepareEvent(session, e);
      if (!prep.ok) {
        results.push({ id: e.id, ok: false, error: prep.error });
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
            [e.id, prep.kind, e.telegramId, JSON.stringify(prep.payload)],
          );
        } catch (err) {
          console.error("[outbox] persist failed", err);
          durable = false;
        }
      }

      try {
        const r = await sendBotLink(e.telegramId, prep.text);
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
