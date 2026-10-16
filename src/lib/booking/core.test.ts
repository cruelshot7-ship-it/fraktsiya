import { test } from "node:test";
import assert from "node:assert/strict";
import { cancelDecision, clientCreateSpec, bookingIdFor, canCancelBooking } from "./core.ts";

const TRAINER = "1000";

test("client cannot create a slot the trainer did not add: no built-in schedule", () => {
  // Вшитых слотов нет: id вида «дата_время» без записи тренера клиент создать не может.
  assert.equal(clientCreateSpec({ trainerId: TRAINER }), null);
  assert.equal(clientCreateSpec({ trainerId: TRAINER, extra: null }), null);
});

test("extra slot takes owner, time, duration and capacity from trainer data, not from the client", () => {
  const spec = clientCreateSpec({
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

test("cancel decision: stale cancel from before a rebook does not touch the new seat", () => {
  // клиент отменил (rev 100), потом записался заново (rev 200); старая отмена приходит позже
  assert.equal(cancelDecision({ status: "confirmed", rev: "200" }, "100"), "stale");
  assert.equal(cancelDecision({ status: "confirmed", rev: "100" }, "100"), "cancel");
  // без версии отмена безусловная (записи до этого релиза)
  assert.equal(cancelDecision({ status: "confirmed", rev: "200" }, null), "cancel");
});

test("cancel decision: attendance wins over a stale revision, so the client sees the real state", () => {
  // тренер отметил приход после записи (rev сменился): отмена должна вернуть «уже пришёл», а не молча пройти
  assert.equal(cancelDecision({ status: "attended", rev: "300" }, "100"), "attended");
  assert.equal(cancelDecision({ status: "no_show", rev: "300" }, "100"), "attended");
});

test("cancel decision: missing and already cancelled rows are no-ops", () => {
  assert.equal(cancelDecision(null, "100"), "not-found");
  assert.equal(cancelDecision({ status: "cancelled", rev: "100" }, "100"), "already-cancelled");
});
