/**
 * Server-side booking with capacity protection.
 * Each write runs in one transaction on one connection (sql.transaction) and takes
 * pg_advisory_xact_lock, so the last seat cannot be double-booked.
 * Логика записи — в ./core.ts (покрыта интеграционным тестом на Postgres).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { verifyTelegramInitData } from "@/lib/telegram-auth.server";
import { TRAINER_TG_ID } from "@/data/studio";
import type { CreateSpec } from "@/lib/booking/core";

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

/** Тренер-coach на паузе или истёк: записывать на его слоты нельзя. */
async function coachBookingBlocked(ownerCoachId: string): Promise<boolean> {
  const { loadStudioState } = await import("@/lib/studio-sync");
  const { coachPhase } = await import("@/data/studio");
  const payload = await loadStudioState();
  const row = (payload.coaches ?? []).find((c) => c.telegramId === ownerCoachId);
  const phase = row ? coachPhase(row) : "expired";
  return phase !== "trial" && phase !== "paid";
}

export const bookSlotFn = createServerFn({ method: "POST" })
  .validator(BookInput)
  .handler(async ({ data }): Promise<BookSlotResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const trainerId = String(TRAINER_TG_ID);
    try {
      const { getSql } = await import("@/lib/db");
      const { bookSlotCore, slotOwnerOf, clientCreateSpec } = await import("@/lib/booking/core");
      const sql = await getSql();

      if (session.role === "client") {
        // Клиент: только себя. Слот в БД, если его нет, создаём только по правилам сервера.
        const selfClientId = `tg_${session.user.id}`;
        if (data.clientId !== selfClientId && data.clientId !== session.user.id) {
          return { ok: false, reason: "forbidden" };
        }
        let owner = await slotOwnerOf(sql, data.slotId);
        let create: CreateSpec | null = null;
        if (!owner) {
          const { loadStudioState } = await import("@/lib/studio-sync");
          const payload = await loadStudioState();
          const extra = (payload.extraSlots ?? []).find((s) => s.id === data.slotId) ?? null;
          create = clientCreateSpec({ slotId: data.slotId, trainerId, extra });
          if (!create) return { ok: false, reason: "slot-missing" };
          owner = create.ownerCoachId;
        }
        if (owner !== trainerId && (await coachBookingBlocked(owner))) {
          return { ok: false, reason: "paused" };
        }
        return bookSlotCore(sql, { slotId: data.slotId, clientId: selfClientId, create });
      }

      // Тренер: может записывать любого клиента и создать слот.
      const ownerCoachId = data.ownerCoachId || trainerId;
      if (ownerCoachId !== trainerId && (await coachBookingBlocked(ownerCoachId))) {
        return { ok: false, reason: "paused" };
      }
      const capacity = data.capacity ?? 1;
      return bookSlotCore(sql, {
        slotId: data.slotId,
        clientId: data.clientId,
        create: {
          ownerCoachId,
          startsAt: data.startsAt,
          timezone: data.timezone || "Europe/Minsk",
          durationMin: data.durationMin ?? 60,
          capacity,
          kind: data.kind ?? (capacity <= 1 ? "individual" : "group"),
        },
      });
    } catch (err) {
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
  | { ok: false; reason: "no-telegram" | "forbidden" | "booking-missing" | "client-mismatch" | "booking-cancelled" | "no-attendance" | "server-error" | string };

const CancelInput = z.object({
  initData: z.string().min(1),
  slotId: z.string().min(1).max(120),
  clientId: z.string().min(1).max(120),
});

export type CancelBookingResponse =
  | { ok: true; cancelled: boolean }
  | { ok: false; reason: string };

/** Отмена записи в Neon. Права — canCancelBooking: клиент — своя запись, тренер — запись на его слот. */
export const cancelBookingFn = createServerFn({ method: "POST" })
  .validator(CancelInput)
  .handler(async ({ data }): Promise<CancelBookingResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };
    try {
      const { getSql } = await import("@/lib/db");
      const { cancelBookingCore, canCancelBooking, slotOwnerOf } = await import("@/lib/booking/core");
      const sql = await getSql();
      const owner = await slotOwnerOf(sql, data.slotId);
      // слота нет в Neon — и записи там нет, место занято не может быть
      if (owner === null) return { ok: true, cancelled: false };
      const allowed = canCancelBooking({
        role: session.role === "client" ? "client" : "trainer",
        selfIds: [`tg_${session.user.id}`, session.user.id],
        bookingClientId: data.clientId,
        sessionUserId: session.user.id,
        ownerCoachId: owner,
      });
      if (!allowed) return { ok: false, reason: "forbidden" };
      const res = await cancelBookingCore(sql, { slotId: data.slotId, clientId: data.clientId, actorId: session.user.id });
      if (!res.ok) return { ok: false, reason: res.reason };
      return { ok: true, cancelled: res.cancelled };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[cancel] failed:", msg);
      return { ok: false, reason: "server-error" };
    }
  });

export const recordSessionResultFn = createServerFn({ method: "POST" })
  .validator(ResultInput)
  .handler(async ({ data }): Promise<RecordResultResponse> => {
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };
    if (session.role === "client") return { ok: false, reason: "forbidden" };

    const resultId = `sr_${data.bookingId}`;
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      return await sql.transaction(async (tx): Promise<RecordResultResponse> => {
        await tx.query("select pg_advisory_xact_lock(hashtext($1))", [data.bookingId]);

        const booking = await tx.query<{ id: string; client_id: string; status: string }>(
          "select id, client_id, status from slot_bookings where id = $1",
          [data.bookingId],
        );
        if (!booking[0]) return { ok: false, reason: "booking-missing" };
        if (booking[0].client_id !== data.clientId) return { ok: false, reason: "client-mismatch" };
        if (booking[0].status === "cancelled") return { ok: false, reason: "booking-cancelled" };
        if (booking[0].status !== "attended") return { ok: false, reason: "no-attendance" };

        const existing = await tx.query<{ id: string }>(
          "select id from session_results where booking_id = $1",
          [data.bookingId],
        );
        if (existing[0]) return { ok: true, resultId: existing[0].id, created: false };

        await tx.query(
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
        return { ok: true, resultId, created: true };
      });
    } catch (err) {
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
    if (session.role === "client") return { ok: false, reason: "forbidden" };

    const status = data.attended ? "attended" : "no_show";
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      return await sql.transaction(async (tx): Promise<MarkAttendanceResponse> => {
        await tx.query("select pg_advisory_xact_lock(hashtext($1))", [data.bookingId]);

        const booking = await tx.query<{ id: string; status: string }>(
          "select id, status from slot_bookings where id = $1",
          [data.bookingId],
        );
        if (!booking[0]) return { ok: false, reason: "booking-missing" };
        if (booking[0].status === "cancelled") return { ok: false, reason: "booking-cancelled" };
        if (booking[0].status === "attended" || booking[0].status === "no_show") {
          return {
            ok: true,
            bookingId: data.bookingId,
            status: booking[0].status as "attended" | "no_show",
          };
        }

        await tx.query(
          `update slot_bookings set status = $2, updated_at = now() where id = $1`,
          [data.bookingId, status],
        );
        await tx.query(
          `insert into session_attendance (id, booking_id, marked_by, attended, note)
           values ($1, $2, $3, $4, $5)
           on conflict (booking_id) do update
             set marked_by = excluded.marked_by,
                 attended = excluded.attended,
                 note = excluded.note,
                 marked_at = now()`,
          [`att_${data.bookingId}`, data.bookingId, session.user.id, data.attended, data.note ?? null],
        );
        return { ok: true, bookingId: data.bookingId, status };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[attendance] failed:", msg);
      return { ok: false, reason: "server-error" };
    }
  });
