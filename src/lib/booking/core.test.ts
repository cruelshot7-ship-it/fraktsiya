import { test } from "node:test";
import assert from "node:assert/strict";
import { clientCreateSpec, bookingIdFor } from "./core.ts";

const TRAINER = "1000";

test("client may create a default-schedule slot: owner forced to trainer, time from id", () => {
  const spec = clientCreateSpec({ slotId: "2026-12-03_18:00", trainerId: TRAINER, clientCapacity: 1 });
  assert.ok(spec);
  assert.equal(spec.ownerCoachId, TRAINER);
  assert.equal(spec.startsAt, "2026-12-03T18:00:00");
  assert.equal(spec.durationMin, 60);
  assert.equal(spec.kind, "individual");
});

test("client capacity is clamped to 1..100 and sets kind", () => {
  const huge = clientCreateSpec({ slotId: "2026-12-03_18:00", trainerId: TRAINER, clientCapacity: 9999 });
  assert.equal(huge?.capacity, 100);
  assert.equal(huge?.kind, "group");
  const zero = clientCreateSpec({ slotId: "2026-12-03_18:00", trainerId: TRAINER, clientCapacity: 0 });
  assert.equal(zero?.capacity, 1);
  const nan = clientCreateSpec({ slotId: "2026-12-03_18:00", trainerId: TRAINER, clientCapacity: Number.NaN });
  assert.equal(nan?.capacity, 1);
});

test("client cannot create a slot with an arbitrary id", () => {
  assert.equal(clientCreateSpec({ slotId: "x", trainerId: TRAINER }), null);
  assert.equal(clientCreateSpec({ slotId: "2026-12-03_18:00; drop table", trainerId: TRAINER }), null);
  assert.equal(clientCreateSpec({ slotId: "2026-13", trainerId: TRAINER }), null);
});

test("extra slot takes owner, time, duration and capacity from trainer data, not from the client", () => {
  const spec = clientCreateSpec({
    slotId: "custom_1",
    trainerId: TRAINER,
    extra: { date: "2026-12-05", time: "09:30", duration: 45, capacity: 6, ownerId: "2222" },
    clientCapacity: 100,
  });
  assert.ok(spec);
  assert.equal(spec.ownerCoachId, "2222");
  assert.equal(spec.startsAt, "2026-12-05T09:30:00");
  assert.equal(spec.durationMin, 45);
  assert.equal(spec.capacity, 6);
});

test("extra slot without owner falls back to the trainer", () => {
  const spec = clientCreateSpec({
    slotId: "custom_2",
    trainerId: TRAINER,
    extra: { date: "2026-12-05", time: "09:30", duration: 60, capacity: 1, ownerId: null },
  });
  assert.equal(spec?.ownerCoachId, TRAINER);
});

test("booking id is stable", () => {
  assert.equal(bookingIdFor("s1", "tg_5"), "bk_s1_tg_5");
});
