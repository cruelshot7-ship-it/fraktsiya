import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

/**
 * Напоминания клиентам по расписанию. Тариф Hobby не даёт частый cron Vercel, поэтому
 * GitHub Actions (.github/workflows/reminders.yml) дёргает этот маршрут каждые 15 минут.
 * Закрыто секретом CRON_SECRET, как и /api/bot-sweep. Отправка идемпотентна: метки «уже отправлено»
 * ставятся до отправки (claimReminders), поэтому частые вызовы не дублируют сообщения.
 */
function authorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const Route = createFileRoute("/api/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { env } = await import("@/lib/env.server");
        if (!authorized(request.headers.get("authorization"), env("CRON_SECRET"))) {
          return Response.json({ ok: false }, { status: 401 });
        }
        const { loadStudioState } = await import("@/lib/studio-sync");
        const { sendDueReminders } = await import("@/lib/telegram-bot.server");
        await sendDueReminders(await loadStudioState());
        return Response.json({ ok: true });
      },
    },
  },
});
