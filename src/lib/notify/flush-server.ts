/**
 * Server: deliver pending outbox rows via Telegram Bot API (best-effort).
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
};

export const flushOutboxServerFn = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }): Promise<FlushResult> => {
    const { sendBotLink } = await import("@/lib/telegram-bot.server");
    const results: FlushResult["results"] = [];

    for (const e of data.events) {
      const payload = e.payload ?? {};
      const date = String(payload.date ?? "");
      const time = String(payload.time ?? "");
      let text = "";
      if (e.kind === "booking_confirmed") {
        text = date && time ? `Запись подтверждена: ${date} · ${time}` : "Запись подтверждена.";
      } else if (e.kind === "booking_cancelled") {
        text = "Запись отменена.";
      } else {
        text = `Уведомление: ${e.kind}`;
      }
      try {
        const r = await sendBotLink(e.telegramId, text);
        results.push({
          id: e.id,
          ok: Boolean(r && (r as { ok?: boolean }).ok !== false),
          error: (r as { description?: string })?.description,
        });
      } catch (err) {
        results.push({
          id: e.id,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return { results };
  });
