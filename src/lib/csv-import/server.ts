/**
 * Trainer CSV / manual client upsert → Neon app_users (dual-write).
 * Clients without Telegram get synthetic telegram_id `import:<localId>`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyTelegramInitData } from "@/lib/telegram-auth.server";
import { TRAINER_TG_ID } from "@/data/studio";

const ClientRow = z.object({
  id: z.string().min(1).max(120),
  firstName: z.string().max(80).default(""),
  lastName: z.string().max(80).default(""),
  telegramUsername: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
});

const Input = z.object({
  initData: z.string().min(1),
  clients: z.array(ClientRow).min(1).max(50),
});

export type ImportClientsResponse =
  | { ok: true; upserted: number; durable: boolean }
  | { ok: false; reason: string };

export const importClientsFn = createServerFn({ method: "POST" })
  .validator(Input)
  .handler(async ({ data }): Promise<ImportClientsResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "unauthorized" };

    const tgId = String(session.user.id);
    const isTrainer =
      tgId === String(TRAINER_TG_ID) || session.user.id === TRAINER_TG_ID;
    if (!isTrainer) {
      // Also allow if already trainer in app_users
      try {
        const { getSql, getDbSource } = await import("@/lib/db");
        if (getDbSource() === "neon") {
          const sql = await getSql();
          const rows = await sql.query<{ role: string }>(
            "select role from app_users where telegram_id = $1 limit 1",
            [tgId],
          );
          if (rows[0]?.role !== "trainer" && rows[0]?.role !== "admin") {
            return { ok: false, reason: "forbidden" };
          }
        } else if (!isTrainer) {
          return { ok: false, reason: "forbidden" };
        }
      } catch {
        if (!isTrainer) return { ok: false, reason: "forbidden" };
      }
    }

    try {
      const { getSql, getDbSource } = await import("@/lib/db");
      if (getDbSource() !== "neon") {
        return { ok: true, upserted: 0, durable: false };
      }
      const sql = await getSql();
      let upserted = 0;

      for (const c of data.clients) {
        const uname = (c.telegramUsername || "").replace(/^@/, "").trim();
        const telegramId = uname
          ? `username:${uname.toLowerCase()}`
          : `import:${c.id}`;
        try {
          await sql.query(
            `insert into app_users (id, telegram_id, role, first_name, last_name, username)
             values ($1, $2, 'client', $3, $4, $5)
             on conflict (id) do update set
               first_name = excluded.first_name,
               last_name = excluded.last_name,
               username = coalesce(excluded.username, app_users.username),
               updated_at = now()`,
            [
              c.id,
              telegramId,
              c.firstName || "",
              c.lastName || "",
              uname || null,
            ],
          );
          upserted += 1;
        } catch (err) {
          // unique telegram_id collision — try update by telegram_id
          try {
            await sql.query(
              `update app_users set
                 first_name = $2, last_name = $3, username = $4, updated_at = now()
               where telegram_id = $1`,
              [telegramId, c.firstName || "", c.lastName || "", uname || null],
            );
            upserted += 1;
          } catch (e2) {
            console.error("[importClients]", e2);
          }
        }
      }

      return { ok: true, upserted, durable: true };
    } catch (err) {
      console.error("[importClients] failed", err);
      return { ok: false, reason: "server-error" };
    }
  });
