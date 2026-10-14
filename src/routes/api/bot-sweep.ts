import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/** Ежедневная уборка уведомлений бота. Vercel Cron шлёт Authorization: Bearer CRON_SECRET. Без секрета закрыто. */
function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const Route = createFileRoute("/api/bot-sweep")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env } = await import("@/lib/env.server");
        if (!authorized(request.headers.get("authorization"), env("CRON_SECRET"))) {
          return Response.json({ ok: false }, { status: 401 });
        }
        const { sweepBotMessages } = await import("@/lib/bot-retention.server");
        const result = await sweepBotMessages(new Date(), 100);
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
