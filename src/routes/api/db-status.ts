import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/db-status")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
    },
  },
});
