import { test } from "node:test";
import assert from "node:assert/strict";
import { trainerAlertsEnabled, trainerBookingAlertText } from "./trainer-alert";

test("trainerAlertsEnabled: включено по умолчанию, выключается только явным false", () => {
  assert.equal(trainerAlertsEnabled(undefined), true);
  assert.equal(trainerAlertsEnabled({}), true);
  assert.equal(trainerAlertsEnabled({ notifyTrainer: true }), true);
  assert.equal(trainerAlertsEnabled({ notifyTrainer: false }), false);
});

test("trainerBookingAlertText: запись и отмена с именем и временем", () => {
  const book = trainerBookingAlertText("book", "Мария К.", "2026-10-21", "18:00");
  assert.match(book, /^Новая запись: Мария К\./);
  assert.match(book, /18:00$/);
  const cancel = trainerBookingAlertText("cancel", "Мария К.", "2026-10-21", "18:00");
  assert.match(cancel, /^Отмена записи: Мария К\./);
});

test("trainerBookingAlertText: пустое имя не ломает текст", () => {
  assert.match(trainerBookingAlertText("book", "  ", "2026-10-21", "18:00"), /^Новая запись: Клиент\n/);
});
