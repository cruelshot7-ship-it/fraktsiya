/**
 * Server-side booking with capacity protection.
 * Uses pg_advisory_xact_lock so the last seat cannot double-book.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyTelegramInitData } from "@/lib/auth/telegram-init";
import { TRAINER_TG_ID } from "@/lib/auth/config";

const BookInput = z.object({
  initData: z.string().min(1),
  slotId: z.string().min(1).max(120),
  clientId: z.string().min(1).max(120),
  startsAt: z.string().min(1),
  timezone: z.string().min(1).max(80).optional(),
  durationMin: z.number().int().positive().max(480).optional(),
  capacity: z.number().int().positive().max(100).optional(),
  kind: z.enum(["individual", "group"]).optional(),
  ownerCoachId: z.string().optional(),
});

export type BookSlotResponse =
  | { ok: true; bookingId: string }
  | { ok: false; reason: string };

async function ensureSlot(
  sql: { query: <T>(q: string, p?: unknown[]) => Promise<T[]> },
  data: z.infer<typeof BookInput>,
  ownerCoachId: string,
) {
  const existing = await sql.query<{ id: string; capacity: number; status: string }>(
    "select id, capacity, status from training_slots where id = $1",
    [data.slotId],
  );
  if (existing[0]) return existing[0];

  const startsAt = data.startsAt.includes("T")
    ? data.startsAt
    : `${data.startsAt.replace(" ", "T")}`;
  const tz = data.timezone || "Europe/Minsk";
  const duration = data.durationMin ?? 60;
  const capacity = data.capacity ?? 1;
  const kind = data.kind ?? (capacity <= 1 ? "individual" : "group");

  await sql.query(
    `insert into training_slots
      (id, owner_coach_id, starts_at, timezone, duration_min, capacity, kind, status)
     values ($1, $2, $3::timestamptz, $4, $5, $6, $7, 'open')
     on conflict (id) do nothing`,
    [data.slotId, ownerCoachId, startsAt.replace("Z", "").slice(0, 19), tz, duration, capacity, kind],
  );

  const again = await sql.query<{ id: string; capacity: number; status: string }>(
    "select id, capacity, status from training_slots where id = $1",
    [data.slotId],
  );
  return again[0];
}

export const bookSlotFn = createServerFn({ method: "POST" })
  .validator(BookInput)
  .handler(async ({ data }): Promise<BookSlotResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const ownerCoachId = data.ownerCoachId || String(TRAINER_TG_ID);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();

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

      const prior = await sql.query<{ id: string }>(
        "select id from slot_bookings where slot_id = $1 and client_id = $2 and status <> 'cancelled'",
        [data.slotId, data.clientId],
      );
      if (prior[0]) {
        await sql.query("rollback");
        return { ok: true, bookingId: prior[0].id };
      }

      const countRows = await sql.query<{ n: string }>(
        "select count(*)::text as n from slot_bookings where slot_id = $1 and status <> 'cancelled'",
        [data.slotId],
      );
      const taken = Number(countRows[0]?.n ?? 0);
      if (taken >= slot.capacity) {
        await sql.query("rollback");
        return { ok: false, reason: "full" };
      }

      const bookingId = `bk_${data.slotId}_${data.clientId}`;
      await sql.query(
        `insert into slot_bookings (id, slot_id, client_id, status)
         values ($1, $2, $3, 'confirmed')
         on conflict (slot_id, client_id) do update set status = 'confirmed', updated_at = now()`,
        [bookingId, data.slotId, data.clientId],
      );

      await sql.query("commit");
      return { ok: true, bookingId };
    } catch (err) {
      try {
        await sql.query("rollback");
      } catch {
        /* ignore */
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[book] failed:", msg);
      return { ok: false, reason: "server-error" };
    }
  });

const ResultInput = z.object({
  initData: z.string().min(1),
  bookingId: z.string().min(1),
  clientId: z.string().min(1),
  coachId: z.string().min(1).max(120),
  programId: z.string().optional(),
  programVersion: z.number().int().optional(),
  sets: z.array(z.any()).max(200),
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
      if (booking[0].status !== "attended") {
        await sql.query("rollback");
        return { ok: false, reason: "no-attendance" };
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

const AttendanceInput = z.object({
  initData: z.string().min(1),
  bookingId: z.string().min(1),
  attended: z.boolean(),
  note: z.string().max(500).optional(),
});

export type MarkAttendanceResponse =
  | { ok: true; bookingId: string; status: "attended" | "no_show" }
  | { ok: false; reason: string };

/** Confirm or deny attendance. Idempotent. Does not invent attendance from clock. */
export const markAttendanceFn = createServerFn({ method: "POST" })
  .validator(AttendanceInput)
  .handler(async ({ data }): Promise<MarkAttendanceResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const status = data.attended ? "attended" : "no_show";

    try {
      await sql.query("begin");
      await sql.query("select pg_advisory_xact_lock(hashtext($1))", [data.bookingId]);

      const booking = await sql.query<{ id: string; status: string }>(
        "select id, status from slot_bookings where id = $1",
        [data.bookingId],
      );
      if (!booking[0]) {
        await sql.query("rollback");
        return { ok: false, reason: "booking-missing" };
      }
      if (booking[0].status === "cancelled") {
        await sql.query("rollback");
        return { ok: false, reason: "booking-cancelled" };
      }
      if (booking[0].status === "attended" || booking[0].status === "no_show") {
        await sql.query("rollback");
        return {
          ok: true,
          bookingId: data.bookingId,
          status: booking[0].status as "attended" | "no_show",
        };
      }

      await sql.query(
        `update slot_bookings set status = $2, updated_at = now() where id = $1`,
        [data.bookingId, status],
      );
      await sql.query(
        `insert into session_attendance (id, booking_id, marked_by, attended, note)
         values ($1, $2, $3, $4, $5)
         on conflict (booking_id) do update
           set marked_by = excluded.marked_by,
               attended = excluded.attended,
               note = excluded.note,
               marked_at = now()`,
        [`att_${data.bookingId}`, data.bookingId, session.user.id, data.attended, data.note ?? null],
      );

      await sql.query("commit");
      return { ok: true, bookingId: data.bookingId, status };
    } catch (err) {
      try {
        await sql.query("rollback");
      } catch {
        /* ignore */
      }
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[attendance] failed:", msg);
      return { ok: false, reason: "server-error" };
    }
  });
