import assert from "node:assert/strict";
import test from "node:test";
import { dueReminders, findByToken, markReminder, remindToken } from "./studio-remind.ts";
import type { Booking } from "../data/studio.ts";

function booking(id: string, date: string, time: string, extra: Partial<Booking> = {}): Booking {
  return { id, slotId: "s", clientId: "c1", date, time, duration: 60, ...extra };
}

test("24h reminder fires once, then the 2h one", () => {
  const now = Date.parse("2026-09-29T19:00:00");
  const row = booking("bk_long_id_abc123xyz890", "2026-09-30", "19:00");
  const first = dueReminders([row], now);
  assert.deepEqual(first, [{ id: row.id, kind: "24" }]);
  const after24 = markReminder([row], row.id, "24");
  assert.equal(dueReminders(after24, now).length, 0);
  const twoHours = Date.parse("2026-09-30T17:00:00");
  const second = dueReminders(after24, twoHours);
  assert.deepEqual(second, [{ id: row.id, kind: "2" }]);
});

test("past or checked-in bookings stay quiet", () => {
  const now = Date.parse("2026-09-30T20:00:00");
  assert.equal(dueReminders([booking("a", "2026-09-30", "19:00")], now).length, 0);
  assert.equal(dueReminders([booking("b", "2026-09-30", "21:00", { checkedIn: true })], now).length, 0);
});

test("callback token finds the booking", () => {
  const row = booking("bk_2026-09-30_19:00_c1_1790658911190", "2026-09-30", "19:00");
  const token = remindToken(row.id);
  assert.ok(token.length <= 16);
  assert.equal(findByToken([row], token)?.id, row.id);
});
