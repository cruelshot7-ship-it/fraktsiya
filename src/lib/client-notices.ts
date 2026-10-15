/**
 * Открытие одноразового уведомления из приложения. Текст отдаётся один раз тому клиенту, которому он адресован.
 * Правила — notice-rules.ts, хранение — client-notices.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { knownSession } from "@/lib/food-catalog";

const OpenInput = z.object({
  initData: z.string().optional(),
  id: z.number().int().positive().max(999_999_999_999),
});

export type OpenNoticeResult =
  | { ok: true; body: string }
  | { ok: false; reason: "not-allowed" | "opened" | "expired" | "missing" };

export const openClientNoticeFn = createServerFn({ method: "POST" })
  .validator(OpenInput)
  .handler(async ({ data }): Promise<OpenNoticeResult> => {
    const session = await knownSession(data.initData);
    if (!session) return { ok: false, reason: "not-allowed" };
    const userId = String(session.user.id);
    const { openClientNotice } = await import("@/lib/client-notices.server");
    const res = await openClientNotice(data.id, userId, new Date());
    if (res.verdict !== "open") return { ok: false, reason: res.verdict };
    // текст уже выдан: кнопку в чате убираем, чтобы не висела пустой
    if (res.chatMessageId !== null) {
      const { deleteBotMessageNow } = await import("@/lib/bot-retention.server");
      await deleteBotMessageNow(userId, res.chatMessageId);
    }
    return { ok: true, body: res.body };
  });
