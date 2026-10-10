import assert from "node:assert/strict";
import test from "node:test";
import { claimReminders, dueReminders, findByToken, markReminder, remindToken } from "./studio-remind.ts";
import type { Booking } from "../data/studio.ts";

function booking(id: string, date: string, time: string, extra: Partial<Booking> = {}): Booking {
  return { id, slotId: "s", clientId: "c1", date, time, duration: 60, ...extra };
}

test("24h reminder fires once, then the 2h one", () => {
  const now = Date.parse("2026-09-29T19:00:00+03:00");
  const row = booking("bk_long_id_abc123xyz890", "2026-09-30", "19:00");
  const first = dueReminders([row], now);
  assert.deepEqual(first, [{ id: row.id, kind: "24" }]);
  const after24 = markReminder([row], row.id, "24");
  assert.equal(dueReminders(after24, now).length, 0);
  const twoHours = Date.parse("2026-09-30T17:00:00+03:00");
  const second = dueReminders(after24, twoHours);
  assert.deepEqual(second, [{ id: row.id, kind: "2" }]);
});

test("past or checked-in bookings stay quiet", () => {
  const now = Date.parse("2026-09-30T20:00:00+03:00");
  assert.equal(dueReminders([booking("a", "2026-09-30", "19:00")], now).length, 0);
  assert.equal(dueReminders([booking("b", "2026-09-30", "21:00", { checkedIn: true })], now).length, 0);
});

test("callback token finds the booking", () => {
  const row = booking("bk_2026-09-30_19:00_c1_1790658911190", "2026-09-30", "19:00");
  const token = remindToken(row.id);
  assert.ok(token.length <= 16);
  assert.equal(findByToken([row], token)?.id, row.id);
});

test("reminder timing is the same in any server timezone (club time is UTC+3)", async () => {
  const { slotHours } = await import("./studio-remind.ts");
  // 19:00 club time is 16:00 UTC, whatever zone the code runs in
  assert.equal(slotHours("2026-09-30", "19:00", Date.parse("2026-09-30T14:00:00Z")), 2);
});

test("a committed claim leaves nothing due, so a retry or a second request sends nothing", () => {
  const now = Date.parse("2026-09-29T19:00:00+03:00");
  const row = booking("bk_claim_test_0000000001", "2026-09-30", "19:00");
  const due = dueReminders([row], now);
  const claimed = claimReminders([row], due);
  assert.equal(dueReminders(claimed, now).length, 0);
  // the base state is untouched: a request that lost the write still sees the reminder as due
  assert.equal(dueReminders([row], now).length, 1);
});

test("claiming several due reminders marks each kind on its own booking", () => {
  const now = Date.parse("2026-09-30T17:00:00+03:00");
  const rows = [booking("a_booking_0000000000001", "2026-09-30", "19:00"), booking("b_booking_0000000000002", "2026-09-30", "20:00", { reminded24: true })];
  const due = dueReminders(rows, now);
  assert.deepEqual(due.map((item) => item.id).sort(), ["a_booking_0000000000001", "b_booking_0000000000002"]);
  const claimed = claimReminders(rows, due);
  assert.equal(dueReminders(claimed, now).length, 0);
  assert.equal(claimed.find((row) => row.id === "a_booking_0000000000001")?.reminded2, true);
});
