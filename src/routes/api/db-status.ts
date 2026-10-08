import { createFileRoute } from "@tanstack/react-router";

// Route tree may lag behind new API files until next codegen pass.
// @ts-expect-error path registered at runtime via file-based routing
export const Route = createFileRoute("/api/db-status")({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
    },
  },
});
