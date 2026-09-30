import { createFileRoute } from "@tanstack/react-router";
import { getDbSource, getSql } from "@/lib/db";

function schemeHint(raw?: string): string {
  if (!raw?.trim()) return "empty";
  const s = raw.trim().replace(/^['"]|['"]$/g, "");
  const m = s.match(/^(postgres(?:ql)?:\/\/)/i);
  if (m) return m[1].toLowerCase() + (s.includes("-pooler") ? "+pooler" : "");
  return `other:${s.slice(0, 16)}`;
}

export const Route = createFileRoute("/api/db-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const doCanary = url.searchParams.get("canary") === "1";

        const rawPrimary =
          typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
        const rawUnpooled =
          typeof process !== "undefined"
            ? process.env.DATABASE_URL_UNPOOLED
            : undefined;

        const envKeys = {
          DATABASE_URL: Boolean(rawPrimary?.trim()),
          DATABASE_URL_UNPOOLED: Boolean(rawUnpooled?.trim()),
          schemePrimary: schemeHint(rawPrimary),
          schemeUnpooled: schemeHint(rawUnpooled),
          schemeActive: schemeHint(
            /^postgres/i.test(rawPrimary?.trim() || "")
              ? rawPrimary
              : rawUnpooled,
          ),
        };

        const source = getDbSource();
        const base: Record<string, unknown> = {
          ok: true,
          source,
          envKeys,
          tables: {} as Record<string, boolean>,
          counts: {} as Record<string, number>,
          canary: null as null | { ok: boolean; error?: string },
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
              (base.tables as Record<string, boolean>)[name] = Boolean(
                rows[0]?.exists,
              );
            } catch {
              (base.tables as Record<string, boolean>)[name] = false;
            }
          }

          for (const name of [
            "training_slots",
            "slot_bookings",
            "session_results",
            "notify_outbox",
          ]) {
            try {
              const rows = await sql.query<{ n: string }>(
                `select count(*)::text as n from ${name}`,
              );
              (base.counts as Record<string, number>)[name] = Number(
                rows[0]?.n ?? 0,
              );
            } catch {
              (base.counts as Record<string, number>)[name] = -1;
            }
          }

          if (doCanary && source === "neon") {
            const id = `canary_${Date.now()}`;
            try {
              await sql.query(
                `insert into notify_outbox (id, kind, telegram_id, payload, status)
                 values ($1, 'canary', '0', '{}'::jsonb, 'pending')`,
                [id],
              );
              await sql.query(`delete from notify_outbox where id = $1`, [id]);
              base.canary = { ok: true };
            } catch (err) {
              base.canary = {
                ok: false,
                error: String((err as Error)?.message || err).slice(0, 120),
              };
              base.ok = false;
            }
          }

          const tables = base.tables as Record<string, boolean>;
          const coreOk =
            tables.training_slots &&
            tables.slot_bookings &&
            tables.session_results;

          if (source === "pglite") {
            base.migrateHint = "No valid postgres URL at runtime.";
            base.ok = false;
          } else if (!coreOk) {
            base.migrateHint = "Neon up but core tables missing.";
            base.ok = false;
          } else {
            base.migrateHint = "Neon + core schema OK.";
          }

          return Response.json(base);
        } catch (err) {
          return Response.json(
            {
              ok: false,
              source,
              envKeys,
              tables: {},
              counts: {},
              canary: null,
              migrateHint: String((err as Error)?.message || err).slice(0, 200),
            },
            { status: 500 },
          );
        }
      },
    },
  },
});
