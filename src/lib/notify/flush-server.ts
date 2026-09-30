/**
 * Server: durable outbox on Neon + Telegram Bot delivery (best-effort).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
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
      const payload = e.payload ?? {};
      if (sql) {
        try {
          await sql.query(
            `insert into notify_outbox (id, kind, telegram_id, payload, status, attempts)
             values ($1, $2, $3, $4::jsonb, 'pending', 0)
             on conflict (id) do update set
               payload = excluded.payload,
               updated_at = now()`,
            [e.id, e.kind, e.telegramId, JSON.stringify(payload)],
          );
        } catch (err) {
          console.error("[outbox] persist failed", err);
          durable = false;
        }
      }

      const date = String(payload.date ?? "");
      const time = String(payload.time ?? "");
      let text = "";
      if (e.kind === "booking_confirmed") {
        text =
          date && time
            ? `Запись подтверждена: ${date} · ${time}`
            : "Запись подтверждена.";
      } else if (e.kind === "booking_cancelled") {
        text = "Запись отменена.";
      } else {
        text = `Уведомление: ${e.kind}`;
      }

      try {
        const r = await sendBotLink(e.telegramId, text);
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
