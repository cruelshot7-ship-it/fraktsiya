import assert from "node:assert/strict";
import test from "node:test";
import { claimReminders, isPermanentSendError, releaseReminder } from "./studio-remind.ts";
import type { Booking } from "../data/studio.ts";

function booking(id: string, extra: Partial<Booking> = {}): Booking {
  return { id, slotId: "s", clientId: "c1", date: "2026-10-12", time: "18:00", duration: 60, ...extra };
}

test("снятие отметки возвращает напоминание в список к отправке", () => {
  const claimed = claimReminders([booking("a")], [{ id: "a", kind: "24" }]);
  assert.equal(claimed[0].reminded24, true);
  const released = releaseReminder(claimed, "a", "24");
  assert.equal(released[0].reminded24, false);
});

test("снятие одного вида не трогает другой", () => {
  const claimed = claimReminders([booking("a", { reminded24: true })], [{ id: "a", kind: "2" }]);
  const released = releaseReminder(claimed, "a", "2");
  assert.equal(released[0].reminded2, false);
  assert.equal(released[0].reminded24, true, "24-часовое напоминание уже ушло и остаётся отмеченным");
});

test("снятие чужой записи ничего не меняет", () => {
  const rows = [booking("a", { reminded2: true }), booking("b")];
  const released = releaseReminder(rows, "b", "2");
  assert.equal(released[0].reminded2, true);
});

test("постоянные ошибки не повторяем", () => {
  assert.equal(isPermanentSendError("Forbidden: bot was blocked by the user"), true);
  assert.equal(isPermanentSendError("Bad Request: chat not found"), true);
  assert.equal(isPermanentSendError("no-token"), true);
});

test("временные ошибки повторяем", () => {
  assert.equal(isPermanentSendError("Too Many Requests: retry after 5"), false);
  assert.equal(isPermanentSendError("Internal Server Error"), false);
  assert.equal(isPermanentSendError(undefined), false);
});
