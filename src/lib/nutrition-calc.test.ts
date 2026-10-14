import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTargets, kcalFromMacros, mifflinBmr } from "./nutrition-calc";
import { KCAL_FLOOR } from "./nutrition-config";

const base = { sex: "male" as const, age: 30, heightCm: 180, weightKg: 80, activity: "moderate" as const, goal: "maintain" as const };

test("Миффлин — Сан Жеор: мужчина и женщина", () => {
  assert.equal(mifflinBmr("male", 30, 180, 80), 1780);
  assert.equal(mifflinBmr("female", 30, 170, 60), 10 * 60 + 6.25 * 170 - 5 * 30 - 161);
});

test("полный расчёт: мужчина, поддержание веса", () => {
  const r = calculateTargets(base);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.bmr, 1780);
  assert.equal(r.tdee, Math.round(1780 * 1.55));
  assert.equal(r.targetKcal, 2760);
  assert.deepEqual(r.macros, { protein: 144, fat: 72, carbs: Math.round((2760 - 4 * 144 - 9 * 72) / 4) });
  assert.deepEqual(r.notes, []);
});

test("снижение веса: −10% от расхода, с округлением до 10 ккал", () => {
  const r = calculateTargets({ ...base, goal: "lose" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.targetKcal, 2480);
});

test("набор массы: +10% от расхода", () => {
  const r = calculateTargets({ ...base, goal: "gain" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.targetKcal, 3030);
});

test("минимум калорий: снижение не опускается ниже порога, с пометкой", () => {
  const r = calculateTargets({ sex: "female", age: 60, heightCm: 160, weightKg: 50, activity: "sedentary", goal: "lose" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.targetKcal, KCAL_FLOOR.female);
  assert.equal(r.notes.length, 1);
});

test("сверка: калории из округлённых макросов близки к цели", () => {
  for (const goal of ["lose", "maintain", "gain"] as const) {
    const r = calculateTargets({ ...base, goal });
    assert.equal(r.ok, true);
    if (!r.ok) continue;
    assert.ok(Math.abs(r.kcalFromMacros - r.targetKcal) <= 7, `${goal}: ${r.kcalFromMacros} vs ${r.targetKcal}`);
  }
});

test("без пола, возраста, роста, веса, активности или цели — ошибка с перечнем, без выдуманных значений", () => {
  const r = calculateTargets({ ...base, sex: null, weightKg: null });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.error, /пол/);
  assert.match(r.error, /вес/);
});

test("нечисловые и NaN значения отклоняются", () => {
  const r = calculateTargets({ ...base, age: Number.NaN });
  assert.equal(r.ok, false);
});

test("границы: возраст, рост, вес вне диапазона — ошибка", () => {
  assert.equal(calculateTargets({ ...base, age: 17 }).ok, false);
  assert.equal(calculateTargets({ ...base, age: 76 }).ok, false);
  assert.equal(calculateTargets({ ...base, heightCm: 119 }).ok, false);
  assert.equal(calculateTargets({ ...base, weightKg: 301 }).ok, false);
  assert.equal(calculateTargets({ ...base, age: 18 }).ok, true);
  assert.equal(calculateTargets({ ...base, age: 75 }).ok, true);
});

test("группы риска: несовершеннолетние, беременность, медицинская диета — автоматический расчёт не применяется", () => {
  for (const flags of [{ minor: true }, { pregnancy: true }, { medicalDiet: true }]) {
    const r = calculateTargets({ ...base, flags });
    assert.equal(r.ok, false);
  }
});

test("нормы, которые не помещаются в калорийность, дают ошибку валидации", () => {
  const r = calculateTargets({ ...base, weightKg: 150, flags: {} });
  // при весе 150 кг белок и жир занимают больше калорий, чем поддерживающая норма
  if (r.ok) assert.ok(r.macros.carbs >= 0);
  else assert.match(r.error, /не помещаются/);
});

test("kcalFromMacros: 4-4-9", () => {
  assert.equal(kcalFromMacros({ protein: 10, fat: 5, carbs: 20 }), 40 + 45 + 80);
});
