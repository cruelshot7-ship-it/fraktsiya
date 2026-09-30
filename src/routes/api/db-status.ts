import { createFileRoute } from "@tanstack/react-router";
import { getDbSource, getSql } from "@/lib/db";

/**
 * Safe readiness probe: backend kind + whether P0 tables exist.
 * Does not return connection strings or row data.
 */
export const Route = createFileRoute("/api/db-status")({
  server: {
    handlers: {
      GET: async () => {
        const source = getDbSource();
        const base = {
          ok: true as boolean,
          source,
          tables: {} as Record<string, boolean>,
          migrateHint: "",
        };

        try {
          const sql = await getSql();
          const names = [
            "training_slots",
            "slot_bookings",
            "session_attendance",
            "session_results",
            "progression_suggestions",
            "notify_outbox",
            "_migrations",
          ];
          for (const name of names) {
            try {
              const rows = await sql.query<{ exists: boolean }>(
                `select exists (
                   select 1 from information_schema.tables
                   where table_schema = 'public' and table_name = $1
                 ) as exists`,
                [name],
              );
              base.tables[name] = Boolean(rows[0]?.exists);
            } catch {
              base.tables[name] = false;
            }
          }

          const coreOk =
            base.tables.training_slots &&
            base.tables.slot_bookings &&
            base.tables.session_results;

          if (source === "pglite") {
            base.migrateHint =
              "No DATABASE_URL / DATABASE_URL_UNPOOLED at runtime. Check Vercel env for Production.";
            base.ok = false;
          } else if (!coreOk) {
            base.migrateHint =
              "Neon connected but core tables missing — redeploy so migrate.mjs runs.";
            base.ok = false;
          } else {
            base.migrateHint = "Neon + core booking schema present.";
          }

          return Response.json(base);
        } catch (err) {
          return Response.json(
            {
              ok: false,
              source,
              tables: {},
              migrateHint: String((err as Error)?.message || err).slice(0, 200),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
