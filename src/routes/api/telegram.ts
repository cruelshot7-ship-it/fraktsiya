import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { ensureBotHook } = await import("@/lib/telegram-bot.server");
        const origin = new URL(request.url).origin;
        const ok = await ensureBotHook(origin.includes("localhost") ? "https://ruksha.vercel.app" : origin);
        return Response.json({ ok, hook: "set" });
      },
      POST: async ({ request }) => {
        const { env } = await import("@/lib/env.server");
        const { handleTelegramUpdate, webhookSecret } = await import("@/lib/telegram-bot.server");
        const tok = env("BOT_TOKEN");
        if (!tok) return new Response("no bot", { status: 503 });
        const secret = request.headers.get("x-telegram-bot-api-secret-token");
        if (secret && secret !== webhookSecret(tok)) return new Response("forbidden", { status: 403 });
        try {
          const update = (await request.json()) as Parameters<typeof handleTelegramUpdate>[0];
          await handleTelegramUpdate(update);
        } catch {
          /* keep 200 so Telegram does not retry forever */
        }
        return new Response("ok");
      },
    },
  },
});
