/**
 * Server-side booking with capacity protection.
 * Works on Neon (real locks) and PGLite (transactional checks).
 * Dual-writes into studio_state JSON for backward compatibility.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyTelegramInitData } from "@/lib/telegram-auth.server";
import { TRAINER_TG_ID } from "@/data/studio";

const BookInput = z.object({
  initData: z.string().optional(),
  slotId: z.string().min(1).max(120),
  clientId: z.string().min(1).max(120),
  startsAt: z.string().optional(),
  timezone: z.string().optional(),
  durationMin: z.number().int().positive().max(480).optional(),
  capacity: z.number().int().positive().max(100).optional(),
  ownerCoachId: z.string().optional(),
  kind: z.enum(["individual", "group", "online"]).optional(),
});

export type BookResult =
  | { ok: true; bookingId: string }
  | { ok: false; reason: string };

function bookingId(slotId: string, clientId: string) {
  return `bk_${slotId}_${clientId}`;
}

async function ensureSlot(
  sql: Awaited<ReturnType<typeof import("@/lib/db").getSql>>,
  data: z.infer<typeof BookInput>,
  ownerCoachId: string,
) {
  const existing = await sql.query<{ id: string; capacity: number; status: string }>(
    "select id, capacity, status from training_slots where id = $1",
    [data.slotId],
  );
  if (existing[0]) return existing[0];

  let startsAt = data.startsAt;
  if (!startsAt) {
    const m = /^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/.exec(data.slotId);
    if (m) {
      startsAt = `${m[1]}T${m[2]}:00`;
    } else {
      startsAt = new Date().toISOString();
    }
  }
  const tz = data.timezone || "Europe/Minsk";
  const duration = data.durationMin ?? 60;
  const capacity = data.capacity ?? 1;
  const kind = data.kind ?? (capacity <= 1 ? "individual" : "group");

  await sql.query(
    `insert into training_slots
      (id, owner_coach_id, starts_at, timezone, duration_min, capacity, kind, status)
     values ($1, $2, ($3::timestamp at time zone $4), $4, $5, $6, $7, 'open')
     on conflict (id) do nothing`,
    [data.slotId, ownerCoachId, startsAt.replace("Z", "").slice(0, 19), tz, duration, capacity, kind],
  );

  const again = await sql.query<{ id: string; capacity: number; status: string }>(
    "select id, capacity, status from training_slots where id = $1",
    [data.slotId],
  );
  return again[0] ?? null;
}

export async function bookSlotTransactional(
  data: z.infer<typeof BookInput>,
  actor: { id: string; role: "trainer" | "client" },
): Promise<BookResult> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();

  const ownerCoachId = data.ownerCoachId || String(TRAINER_TG_ID);
  const id = bookingId(data.slotId, data.clientId);

  try {
    await sql.query("begin");
    await sql.query("select pg_advisory_xact_lock(hashtext($1))", [data.slotId]);

    const slot = await ensureSlot(sql, data, ownerCoachId);
    if (!slot) {
      await sql.query("rollback");
      return { ok: false, reason: "slot-missing" };
    }
    if (slot.status !== "open") {
      await sql.query("rollback");
      return { ok: false, reason: "slot-closed" };
    }

    const active = await sql.query<{ cnt: number }>(
      `select count(*)::int as cnt from slot_bookings
       where slot_id = $1 and status in ('held', 'confirmed', 'attended')`,
      [data.slotId],
    );
    const taken = active[0]?.cnt ?? 0;

    const already = await sql.query<{ id: string; status: string }>(
      `select id, status from slot_bookings where slot_id = $1 and client_id = $2`,
      [data.slotId, data.clientId],
    );
    if (already[0] && ["held", "confirmed", "attended"].includes(already[0].status)) {
      await sql.query("rollback");
      return { ok: false, reason: "already-booked" };
    }

    if (taken >= slot.capacity) {
      await sql.query("rollback");
      return { ok: false, reason: "full" };
    }

    if (already[0]) {
      await sql.query(
        `update slot_bookings set status = 'held', updated_at = now(), cancelled_at = null, cancelled_by = null
         where id = $1`,
        [already[0].id],
      );
    } else {
      await sql.query(
        `insert into slot_bookings (id, slot_id, client_id, client_telegram_id, status)
         values ($1, $2, $3, $4, 'held')`,
        [id, data.slotId, data.clientId, actor.role === "client" ? actor.id : null],
      );
    }

    await sql.query("commit");
    return { ok: true, bookingId: already[0]?.id ?? id };
  } catch (err) {
    try {
      await sql.query("rollback");
    } catch {
      /* ignore */
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return { ok: false, reason: "already-booked" };
    }
    console.error("[booking] failed:", msg);
    return { ok: false, reason: "server-error" };
  }
}

export const bookSlotFn = createServerFn({ method: "POST" })
  .validator(BookInput)
  .handler(async ({ data }): Promise<BookResult> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    return bookSlotTransactional(data, {
      id: session.user.id,
      role: session.role,
    });
  });

const ResultInput = z.object({
  initData: z.string().optional(),
  bookingId: z.string().min(1).max(120),
  clientId: z.string().min(1).max(120),
  coachId: z.string().min(1).max(120),
  programId: z.string().optional(),
  programVersion: z.number().int().positive().optional(),
  sets: z
    .array(
      z.object({
        exercise: z.string().min(1).max(120),
        load: z.number(),
        unit: z.enum(["kg", "lb", "bw"]),
        reps: z.number().int().min(0).max(500),
        targetRepsMin: z.number().int().min(0).max(500),
        targetRepsMax: z.number().int().min(0).max(500),
        setsCompleted: z.number().int().min(0).max(50),
        setsPlanned: z.number().int().min(0).max(50),
      }),
    )
    .max(40),
  rpe: z.number().min(0).max(10).optional(),
  notes: z.string().max(2000).optional(),
});

export type RecordResultResponse =
  | { ok: true; resultId: string; created: boolean }
  | { ok: false; reason: string };

export const recordSessionResultFn = createServerFn({ method: "POST" })
  .validator(ResultInput)
  .handler(async ({ data }): Promise<RecordResultResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const resultId = `sr_${data.bookingId}`;

    try {
      await sql.query("begin");
      await sql.query("select pg_advisory_xact_lock(hashtext($1))", [data.bookingId]);

      const booking = await sql.query<{ id: string; client_id: string; status: string }>(
        "select id, client_id, status from slot_bookings where id = $1",
        [data.bookingId],
      );
      if (!booking[0]) {
        await sql.query("rollback");
        return { ok: false, reason: "booking-missing" };
      }
      if (booking[0].client_id !== data.clientId) {
        await sql.query("rollback");
        return { ok: false, reason: "client-mismatch" };
      }
      if (booking[0].status === "cancelled") {
        await sql.query("rollback");
        return { ok: false, reason: "booking-cancelled" };
      }

      const existing = await sql.query<{ id: string }>(
        "select id from session_results where booking_id = $1",
        [data.bookingId],
      );
      if (existing[0]) {
        await sql.query("rollback");
        return { ok: true, resultId: existing[0].id, created: false };
      }

      await sql.query(
        `insert into session_results
          (id, booking_id, program_id, program_version, client_id, coach_id, sets, rpe, notes, recorded_by)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
        [
          resultId,
          data.bookingId,
          data.programId ?? null,
          data.programVersion ?? null,
          data.clientId,
          data.coachId,
          JSON.stringify(data.sets),
          data.rpe ?? null,
          data.notes ?? null,
          session.user.id,
        ],
      );

      await sql.query(
        `update slot_bookings set status = 'attended', updated_at = now() where id = $1`,
        [data.bookingId],
      );

      await sql.query("commit");
      return { ok: true, resultId, created: true };
    } catch (err) {
      try {
        await sql.query("rollback");
      } catch {
        /* ignore */
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("unique") || msg.includes("duplicate")) {
        return { ok: true, resultId, created: false };
      }
      console.error("[result] failed:", msg);
      return { ok: false, reason: "server-error" };
    }
  });
