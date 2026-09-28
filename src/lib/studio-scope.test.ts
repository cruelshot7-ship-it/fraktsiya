import assert from "node:assert/strict";
import test from "node:test";
import { clientSlotView } from "./studio-scope.ts";
import type { Booking } from "./studio-sync.ts";

function booking(id: string, clientId: string, slotId = "2026-09-28_19:00"): Booking {
  return { id, slotId, clientId, date: "2026-09-28", time: "19:00", duration: 60 };
}

test("a client sees only their booking and a nameless hold", () => {
  const view = clientSlotView(
    [booking("a", "c1"), booking("b", "c2"), booking("c", "c3", "2026-09-28_19:00")],
    "c1",
  );
  assert.deepEqual(view.bookings.map((row) => row.clientId), ["c1"]);
  assert.equal(view.foreignHolds["2026-09-28_19:00"], 2);
  assert.equal(JSON.stringify(view.bookings).includes("c2"), false);
});

test("unknown client gets no names and every seat counts as taken", () => {
  const view = clientSlotView([booking("a", "c1"), booking("b", "c2")], null);
  assert.equal(view.bookings.length, 0);
  assert.equal(view.foreignHolds["2026-09-28_19:00"], 2);
});
