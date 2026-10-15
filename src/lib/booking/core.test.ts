import { test } from "node:test";
import assert from "node:assert/strict";
import { clientCreateSpec, bookingIdFor, canCancelBooking } from "./core.ts";

const TRAINER = "1000";

test("client may create a default-schedule slot: owner forced to trainer, time from id", () => {
  const spec = clientCreateSpec({ slotId: "2026-12-03_18:00", trainerId: TRAINER });
  assert.ok(spec);
  assert.equal(spec.ownerCoachId, TRAINER);
  assert.equal(spec.startsAt, "2026-12-03T18:00:00");
  assert.equal(spec.durationMin, 60);
});

test("default-schedule capacity comes from the schedule rule, not from the client", () => {
  // 18:00 — вечерний слот (3 места), до 16:00 — 2 места; то же правило, что у слотов тренера
  assert.equal(clientCreateSpec({ slotId: "2026-12-03_18:00", trainerId: TRAINER })?.capacity, 3);
  assert.equal(clientCreateSpec({ slotId: "2026-12-03_09:00", trainerId: TRAINER })?.capacity, 2);
  assert.equal(clientCreateSpec({ slotId: "2026-12-03_09:00", trainerId: TRAINER })?.kind, "group");
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

test("client cancels only own booking; trainer cancels only on own slot", () => {
  const base = { selfIds: ["tg_42", "42"], sessionUserId: "42", ownerCoachId: "1000" };
  assert.equal(canCancelBooking({ ...base, role: "client", bookingClientId: "tg_42" }), true);
  assert.equal(canCancelBooking({ ...base, role: "client", bookingClientId: "42" }), true);
  assert.equal(canCancelBooking({ ...base, role: "client", bookingClientId: "tg_99" }), false);
  // тренер: слот его — может; чужой слот — нет; слота нет — нет
  assert.equal(canCancelBooking({ ...base, role: "trainer", bookingClientId: "tg_99", sessionUserId: "1000", ownerCoachId: "1000" }), true);
  assert.equal(canCancelBooking({ ...base, role: "trainer", bookingClientId: "tg_99", sessionUserId: "42", ownerCoachId: "1000" }), false);
  assert.equal(canCancelBooking({ ...base, role: "trainer", bookingClientId: "tg_99", sessionUserId: "42", ownerCoachId: null }), false);
});
