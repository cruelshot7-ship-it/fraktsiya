import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Coach, Notice } from "@/data/studio";
import { applyCoachNotices, coachNoticeText, dueCoachNotices } from "./coach-notice.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-12T10:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

const coach = (over: Partial<Coach>): Coach => ({
  telegramId: "77",
  username: "a",
  firstName: "Аня",
  lastName: "",
  addedAt: iso(NOW),
  paidUntil: null,
  ...over,
});

test("пробный период: предупреждение за 2 дня и не раньше", () => {
  assert.deepEqual(dueCoachNotices([coach({ addedAt: iso(NOW - 4 * DAY) })], NOW), [], "3 дня — ещё рано");
  const due = dueCoachNotices([coach({ addedAt: iso(NOW - 5.5 * DAY) })], NOW);
  assert.equal(due[0].key, "trial_soon");
  assert.equal(due[0].daysLeft, 2);
});

test("оплаченный доступ: предупреждение за 2 дня до конца", () => {
  const due = dueCoachNotices([coach({ paidUntil: iso(NOW + 1.5 * DAY) })], NOW);
  assert.equal(due[0].key, "paid_soon");
  assert.deepEqual(dueCoachNotices([coach({ paidUntil: iso(NOW + 10 * DAY) })], NOW), []);
});

test("пауза и истечение — отдельные уведомления", () => {
  const paused = dueCoachNotices([coach({ addedAt: iso(NOW - 10 * DAY) })], NOW);
  assert.equal(paused[0].key, "paused");
  const expired = dueCoachNotices([coach({ addedAt: iso(NOW - 20 * DAY) })], NOW);
  assert.equal(expired[0].key, "expired");
});

test("тренер без Telegram не получает уведомлений", () => {
  assert.deepEqual(dueCoachNotices([coach({ telegramId: null, addedAt: iso(NOW - 6 * DAY) })], NOW), []);
});

test("applyCoachNotices: сигнал владельцу и отметка; повтор ничего не меняет", () => {
  const payload: { coaches: Coach[]; notices: Notice[] } = { coaches: [coach({ addedAt: iso(NOW - 6 * DAY) })], notices: [] };
  const first = applyCoachNotices(payload, NOW)!;
  assert.equal(first.next.notices.length, 1);
  assert.equal(first.next.notices[0].audience, "trainer");
  assert.equal(first.next.coaches[0].lastNotice, `trial_soon:${iso(NOW - 6 * DAY)}`);
  assert.equal(applyCoachNotices(first.next, NOW), null, "повтор не дублирует уведомление");
});

test("текст не содержит обещаний оплаты и не зависит от пользовательских строк", () => {
  const text = coachNoticeText({ telegramId: "1", name: "x", key: "trial_soon", daysLeft: 2, stamp: "" });
  assert.match(text, /через 2 дн/);
});
