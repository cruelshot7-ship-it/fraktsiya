import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysIso,
  currentStreak,
  nextVisitIso,
  recentVisitDays,
  slotInLabel,
  weekStartIso,
  weekVisitDays,
} from "./program-screen.ts";

// 2026-10-15 — четверг. Тренировки по ПН, СР, ПТ (dow 0, 2, 4).
const TRAIN = new Set(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-09", "2026-10-07", "2026-10-05"]);
const isTrain = (iso: string) => TRAIN.has(iso);

test("date arithmetic is timezone-safe and week starts on Monday", () => {
  assert.equal(addDaysIso("2026-10-01", -1), "2026-09-30");
  assert.equal(weekStartIso("2026-10-15"), "2026-10-12");
  assert.equal(weekStartIso("2026-10-18"), "2026-10-12");
  assert.equal(weekStartIso("2026-10-12"), "2026-10-12");
});

test("streak counts consecutive training days with a visit", () => {
  assert.equal(currentStreak(["2026-10-12", "2026-10-14"], isTrain, "2026-10-15"), 2);
});

test("a missed training day breaks the streak", () => {
  // 10-09 пропущен, 10-12 и 10-14 есть
  assert.equal(currentStreak(["2026-10-12", "2026-10-14", "2026-10-07"], isTrain, "2026-10-15"), 2);
});

test("rest days neither break nor add to the streak", () => {
  // 10-13 (вт) и 10-11 (вс) — отдых
  assert.equal(currentStreak(["2026-10-09", "2026-10-12", "2026-10-14"], isTrain, "2026-10-15"), 3);
});

test("today's training day without a visit does not break the streak yet", () => {
  assert.equal(currentStreak(["2026-10-12", "2026-10-14"], (iso) => iso === "2026-10-15" || isTrain(iso), "2026-10-15"), 2);
});

test("a visit on a non-training day is not counted in the streak", () => {
  assert.equal(currentStreak(["2026-10-13"], isTrain, "2026-10-15"), 0);
});

test("week counter counts visit days, not bookings, and ignores the future", () => {
  // визиты 12 и 14 окт, и 16 окт (будущее относительно 15-го)
  assert.equal(weekVisitDays(["2026-10-12", "2026-10-14", "2026-10-16"], "2026-10-15"), 2);
  // две записи в один день — один визит
  assert.equal(weekVisitDays(["2026-10-12", "2026-10-12"], "2026-10-15"), 1);
  // прошлая неделя не считается
  assert.equal(weekVisitDays(["2026-10-09"], "2026-10-15"), 0);
});

test("recent visits cover the last seven days including today", () => {
  assert.equal(recentVisitDays(["2026-10-09", "2026-10-15"], "2026-10-15"), 2);
  assert.equal(recentVisitDays(["2026-10-08"], "2026-10-15"), 0);
});

test("next visit is the first training date from the given day, or null", () => {
  assert.equal(nextVisitIso(isTrain, "2026-10-15"), "2026-10-16");
  assert.equal(nextVisitIso(isTrain, "2026-10-16"), "2026-10-16");
  assert.equal(nextVisitIso(() => false, "2026-10-15"), null);
});

test("time to slot reads naturally in minutes and hours", () => {
  assert.equal(slotInLabel(0.5), "30 мин");
  assert.equal(slotInLabel(0.01), "1 мин");
  assert.equal(slotInLabel(1), "1 час");
  assert.equal(slotInLabel(2), "2 часа");
  assert.equal(slotInLabel(5), "5 часов");
  assert.equal(slotInLabel(11), "11 часов");
  assert.equal(slotInLabel(22), "22 часа");
});
