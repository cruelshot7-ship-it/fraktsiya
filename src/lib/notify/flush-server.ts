/**
 * Server: durable outbox on Neon + Telegram Bot delivery (best-effort).
 * Доступ только по проверенной сессии Telegram; правила адресатов — в flush-rules.ts.
 *
 * Защита от повторов: каждое событие обрабатывается в транзакции, строка блокируется
 * (`for update`). Если событие уже `sent`, сообщение не шлётся второй раз, даже когда
 * клиент присылает ту же очередь снова.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Sql } from "@/lib/db-adapters";

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

type Delivery = { id: string; ok: boolean; error?: string };

export const flushOutboxServerFn = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }): Promise<FlushResult> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const { checkFlushEvent } = await import("@/lib/notify/flush-rules");
    const { sendClientNotice } = await import("@/lib/telegram-bot.server");
    const auth = verifyTelegramInitData(data.initData);
    const session = auth ? { role: auth.role, userId: auth.user.id } : null;

    const results: FlushResult["results"] = [];
    let durable = false;

    let sql: Sql | null = null;
    try {
      const { getSql, getDbSource } = await import("@/lib/db");
      if (getDbSource() === "neon") {
        sql = await getSql();
        durable = true;
      }
    } catch {
      sql = null;
    }

    /** Отправка одного сообщения и запись результата. Вызывается только внутри блокировки строки. */
    async function deliver(tx: Sql | null, id: string, telegramId: string, text: string): Promise<Delivery> {
      let ok = false;
      let error: string | undefined;
      try {
        const r = await sendClientNotice(telegramId, text);
        ok = Boolean(r && (r as { ok?: boolean }).ok !== false);
        error = (r as { description?: string })?.description;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }
      if (tx) {
        await tx.query(
          `update notify_outbox
           set status = $2, attempts = attempts + 1, last_error = $3, updated_at = now()
           where id = $1`,
          [id, ok ? "sent" : "failed", error ?? null],
        );
      }
      return { id, ok, error };
    }

    for (const e of data.events) {
      const check = checkFlushEvent({ ...e, payload: e.payload ?? {} }, session);
      if (!check.ok) {
        results.push({ id: e.id, ok: false, error: check.error });
        continue;
      }

      // Без базы повтор не отследить, поэтому отправляем как раньше (best-effort).
      if (!sql) {
        results.push(await deliver(null, e.id, e.telegramId, check.text));
        continue;
      }

      try {
        const delivery = await sql.transaction(async (tx) => {
          await tx.query(
            `insert into notify_outbox (id, kind, telegram_id, payload, status, attempts)
             values ($1, $2, $3, $4::jsonb, 'pending', 0)
             on conflict (id) do nothing`,
            [e.id, e.kind, e.telegramId, JSON.stringify(e.payload ?? {})],
          );
          const [row] = await tx.query<{ status: string }>(
            `select status from notify_outbox where id = $1 for update`,
            [e.id],
          );
          if (row?.status === "sent") return { id: e.id, ok: true } as Delivery;
          return deliver(tx, e.id, e.telegramId, check.text);
        });
        results.push(delivery);
      } catch (err) {
        // Без записи в очередь не шлём: иначе повтор снова даст дубль. Клиент оставит событие в очереди.
        console.error("[outbox] persist failed", err);
        results.push({ id: e.id, ok: false, error: "outbox_unavailable" });
      }
    }
    return { results, durable };
  });
