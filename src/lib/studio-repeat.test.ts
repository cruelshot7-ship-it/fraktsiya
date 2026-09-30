import assert from "node:assert/strict";
import test from "node:test";
import { mapsUrl, repeatWeekSlots } from "./studio-repeat.ts";
import { TRAINER_TG_ID, type Slot } from "../data/studio.ts";

test("repeat week copies own extra slots and closed times, not bookings", () => {
  const extra: Slot[] = [
    { id: "2026-09-29_18:00", date: "2026-09-29", time: "18:00", duration: 60, capacity: 3, seeded: 0, ownerId: TRAINER_TG_ID },
    { id: "2026-09-29_19:00_9", date: "2026-09-29", time: "19:00", duration: 60, capacity: 1, seeded: 0, ownerId: "9" },
  ];
  const next = repeatWeekSlots(extra, ["2026-09-29_07:00"], "2026-09-28", TRAINER_TG_ID);
  assert.deepEqual(
    next.extra.map((slot) => slot.id),
    ["2026-10-06_18:00"],
  );
  assert.equal(next.extra[0].date, "2026-10-06");
  assert.deepEqual(next.closed, ["2026-10-06_07:00"]);
});

test("repeat week skips a slot that already exists next week", () => {
  const extra: Slot[] = [
    { id: "2026-09-29_18:00", date: "2026-09-29", time: "18:00", duration: 60, capacity: 3, seeded: 0 },
    { id: "2026-10-06_18:00", date: "2026-10-06", time: "18:00", duration: 60, capacity: 3, seeded: 0 },
  ];
  const next = repeatWeekSlots(extra, [], "2026-09-28");
  assert.equal(next.extra.length, 0);
});

test("maps url stays empty without an address", () => {
  assert.equal(mapsUrl("  "), "");
  assert.match(mapsUrl("Минск, ул. Тестовая 1"), /query=.*%D0%9C%D0%B8%D0%BD%D1%81%D0%BA/);
});
