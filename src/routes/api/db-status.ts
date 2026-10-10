import { createFileRoute } from "@tanstack/react-router";

// Route tree may lag behind new API files until next codegen pass.
// @ts-expect-error path registered at runtime via file-based routing
export const Route = createFileRoute("/api/db-status")({
  server: {
    handlers: {
      // Really asks the database. Returns only ok, no details, so it leaks nothing about the setup.
      GET: async () => {
        try {
          const { getSql } = await import("@/lib/db");
          const sql = await getSql();
          await sql`select 1`;
          return Response.json({ ok: true });
        } catch {
          return Response.json({ ok: false }, { status: 503 });
        }
      },
    },
  },
});
