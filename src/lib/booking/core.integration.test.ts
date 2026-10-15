/**
 * Интеграционный тест бронирования на настоящем Postgres.
 * Запускается только при TEST_DATABASE_URL (в CI — сервис postgres). Без него — пропуск.
 * ВНИМАНИЕ: база из TEST_DATABASE_URL получает схему заново (drop schema public). Прод не указывать.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { sqlFromPool, type Sql } from "../db-adapters.ts";
import { bookSlotCore, cancelBookingCore, clientCreateSpec, slotOwnerOf } from "./core.ts";

const DB_URL = process.env.TEST_DATABASE_URL?.trim() || "";
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "migrations");
const OWNER = "1000";
const STARTS_AT = "2026-12-01T10:00:00";

async function resetSchema(pool: Pool): Promise<void> {
  await pool.query("drop schema public cascade; create schema public;");
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    // В тестовой базе миграции идут напрямую; маркер одобрения нужен только для прода.
    await pool.query(await readFile(join(migrationsDir, f), "utf8"));
  }
}

describe("bookSlotCore on Postgres", { skip: DB_URL ? false : "TEST_DATABASE_URL not set" }, () => {
  let pool: Pool | undefined;
  let sql: Sql;
  const uniq = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    const { default: pg } = await import("pg");
    const p = new pg.Pool({ connectionString: DB_URL, max: 10 });
    pool = p;
    await resetSchema(p);
    sql = sqlFromPool({
      query: (t, params) => p.query(t, params).then((r) => ({ rows: r.rows })),
      connect: async () => {
        const c = await p.connect();
        return {
          query: (t, params) => c.query(t, params).then((r) => ({ rows: r.rows })),
          release: () => c.release(),
        };
      },
    });
  });

  after(async () => {
    await pool?.end();
  });

  /** Слот создаём напрямую, без записи: иначе тест займёт место сам. */
  async function newSlot(capacity: number): Promise<string> {
    const slotId = `slot_${uniq()}`;
    await sql.query(
      `insert into training_slots (id, owner_coach_id, starts_at, capacity, kind, status)
       values ($1, $2, $3::timestamptz, $4, $5, 'open')`,
      [slotId, OWNER, STARTS_AT, capacity, capacity <= 1 ? "individual" : "group"],
    );
    return slotId;
  }

  it("client cannot create a slot: no row appears, result is slot-missing", async () => {
    const slotId = `slot_${uniq()}`;
    const res = await bookSlotCore(sql, { slotId, clientId: "tg_42" });
    assert.deepEqual(res, { ok: false, reason: "slot-missing" });
    const rows = await sql.query("select id from training_slots where id = $1", [slotId]);
    assert.equal(rows.length, 0);
  });

  it("trainer creates a missing slot with the given owner and capacity", async () => {
    const slotId = `slot_${uniq()}`;
    const res = await bookSlotCore(sql, {
      slotId,
      clientId: "tg_7",
      create: {
        ownerCoachId: OWNER,
        startsAt: STARTS_AT,
        timezone: "Europe/Minsk",
        durationMin: 60,
        capacity: 2,
        kind: "group",
      },
    });
    assert.equal(res.ok, true);
    assert.equal(await slotOwnerOf(sql, slotId), OWNER);
  });

  it("client creates a default-schedule slot via server rule: owner is the trainer, booking succeeds", async () => {
    const slotId = "2026-12-03_18:00";
    await sql.query("delete from slot_bookings where slot_id = $1", [slotId]);
    await sql.query("delete from training_slots where id = $1", [slotId]);
    const create = clientCreateSpec({ slotId, trainerId: OWNER });
    const res = await bookSlotCore(sql, { slotId, clientId: "tg_first", create });
    assert.equal(res.ok, true);
    assert.equal(await slotOwnerOf(sql, slotId), OWNER);
    const rows = await sql.query<{ starts_at: string }>("select starts_at::text from training_slots where id = $1", [slotId]);
    assert.match(rows[0].starts_at, /^2026-12-03 18:00:00/);
  });

  it("cancel frees the seat in Neon: the next client gets it; a repeat cancel is a no-op", async () => {
    const slotId = await newSlot(1);
    assert.equal((await bookSlotCore(sql, { slotId, clientId: "tg_cancel_a" })).ok, true);
    assert.deepEqual(await bookSlotCore(sql, { slotId, clientId: "tg_cancel_b" }), { ok: false, reason: "full" });
    assert.deepEqual(await cancelBookingCore(sql, { slotId, clientId: "tg_cancel_a" }), { ok: true, cancelled: true });
    assert.deepEqual(await cancelBookingCore(sql, { slotId, clientId: "tg_cancel_a" }), { ok: true, cancelled: false });
    assert.equal((await bookSlotCore(sql, { slotId, clientId: "tg_cancel_b" })).ok, true);
  });

  it("stale cancel after a rebook does not cancel the new seat", async () => {
    const slotId = await newSlot(1);
    const first = await bookSlotCore(sql, { slotId, clientId: "tg_rebook" });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    // клиент отменил (версия первой записи), потом записался заново
    assert.deepEqual(await cancelBookingCore(sql, { slotId, clientId: "tg_rebook", expectedRev: first.rev }), { ok: true, cancelled: true });
    const second = await bookSlotCore(sql, { slotId, clientId: "tg_rebook" });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.notEqual(second.rev, first.rev);
    // повтор старой отмены приходит уже после новой записи
    assert.deepEqual(await cancelBookingCore(sql, { slotId, clientId: "tg_rebook", expectedRev: first.rev }), { ok: true, cancelled: false, stale: true });
    const rows = await sql.query<{ status: string }>("select status from slot_bookings where slot_id = $1 and client_id = $2", [slotId, "tg_rebook"]);
    assert.equal(rows[0]?.status, "confirmed");
    // отмена с актуальной версией работает
    assert.deepEqual(await cancelBookingCore(sql, { slotId, clientId: "tg_rebook", expectedRev: second.rev }), { ok: true, cancelled: true });
  });

  it("attended booking cannot be cancelled", async () => {
    const slotId = await newSlot(1);
    assert.equal((await bookSlotCore(sql, { slotId, clientId: "tg_att" })).ok, true);
    await sql.query("update slot_bookings set status = 'attended' where slot_id = $1", [slotId]);
    assert.deepEqual(await cancelBookingCore(sql, { slotId, clientId: "tg_att" }), { ok: false, reason: "already-attended" });
  });

  it("two seats: first two clients book, third gets full", async () => {
    const slotId = await newSlot(2);
    const a = await bookSlotCore(sql, { slotId, clientId: "tg_a" });
    const b = await bookSlotCore(sql, { slotId, clientId: "tg_b" });
    const c = await bookSlotCore(sql, { slotId, clientId: "tg_c" });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.deepEqual(c, { ok: false, reason: "full" });
  });

  it("race for the last seat: 10 parallel clients → exactly one booking", async () => {
    const slotId = await newSlot(1);
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        bookSlotCore(sql, { slotId, clientId: `tg_race_${i}` }),
      ),
    );
    const ok = results.filter((r) => r.ok).length;
    const full = results.filter((r) => !r.ok && r.reason === "full").length;
    assert.equal(ok, 1, "exactly one winner");
    assert.equal(full, 9, "everyone else sees full");
    const active = await sql.query<{ n: string }>(
      "select count(*)::text as n from slot_bookings where slot_id = $1 and status <> 'cancelled'",
      [slotId],
    );
    assert.equal(Number(active[0].n), 1);
  });

  it("same client twice: same booking id, one row", async () => {
    const slotId = await newSlot(5);
    const first = await bookSlotCore(sql, { slotId, clientId: "tg_twice" });
    const second = await bookSlotCore(sql, { slotId, clientId: "tg_twice" });
    assert.equal(first.ok && second.ok, true);
    if (first.ok && second.ok) assert.equal(first.bookingId, second.bookingId);
    const rows = await sql.query("select id from slot_bookings where slot_id = $1", [slotId]);
    assert.equal(rows.length, 1);
  });

  it("closed slot refuses booking", async () => {
    const slotId = await newSlot(3);
    await sql.query("update training_slots set status = 'closed' where id = $1", [slotId]);
    const res = await bookSlotCore(sql, { slotId, clientId: "tg_closed" });
    assert.deepEqual(res, { ok: false, reason: "slot-closed" });
  });

  it("a failed transaction leaves no partial rows", async () => {
    const slotId = `slot_${uniq()}`;
    await assert.rejects(
      sql.transaction(async (tx) => {
        await tx.query(
          "insert into training_slots (id, owner_coach_id, starts_at) values ($1, $2, now())",
          [slotId, OWNER],
        );
        throw new Error("abort");
      }),
      /abort/,
    );
    const rows = await sql.query("select id from training_slots where id = $1", [slotId]);
    assert.equal(rows.length, 0);
  });

  it("slotOwnerOf returns the stored owner; unknown slot → null", async () => {
    const slotId = await newSlot(1);
    assert.equal(await slotOwnerOf(sql, slotId), OWNER);
    assert.equal(await slotOwnerOf(sql, `missing_${uniq()}`), null);
  });
});
