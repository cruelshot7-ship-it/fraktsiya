import assert from "node:assert/strict";
import test from "node:test";
import { buildDayMenu, dayStatus, dayTotals, MEAL_PATTERNS, slotTargets, type DishLike, type Macro } from "./menu-plan.ts";

const NORM: Macro = { calories: 2400, protein: 180, fat: 70, carbs: 260 };

function dish(id: string, calories: number, protein: number, kind?: DishLike["kind"]): DishLike {
  return { id, name: id, calories, protein, fat: 10, carbs: 30, kind };
}

const BASE: DishLike[] = [
  dish("oats", 420, 24, "breakfast"),
  dish("omelette", 450, 28, "breakfast"),
  dish("yogurt", 290, 26, "breakfast"),
  dish("shake", 240, 32, "snack"),
  dish("bowl", 610, 48, "lunch"),
  dish("salad", 380, 32, "lunch"),
  dish("fish", 520, 42, "dinner"),
  dish("chicken", 560, 46, "dinner"),
  dish("eggs", 380, 26, "breakfast"),
  dish("pasta", 640, 30, "lunch"),
  dish("cottage", 230, 28, "snack"),
  dish("beef", 600, 50, "dinner"),
];

test("доли каждого шаблона в сумме дают 1", () => {
  for (const count of [3, 4, 5] as const) {
    const sum = MEAL_PATTERNS[count].reduce((acc, slot) => acc + slot.share, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `шаблон ${count}: сумма ${sum}`);
  }
});

test("цели по приёмам складываются в норму с округлением", () => {
  for (const count of [3, 4, 5] as const) {
    const slots = slotTargets(NORM, MEAL_PATTERNS[count]);
    const kcal = slots.reduce((acc, s) => acc + s.target.calories, 0);
    assert.ok(Math.abs(kcal - NORM.calories) <= count, `шаблон ${count}: калории ${kcal}`);
  }
});

test("на каждый приём до трёх вариантов, без повторов внутри приёма", () => {
  const menu = buildDayMenu(NORM, 4, BASE);
  assert.equal(menu.ok, true);
  if (!menu.ok) return;
  assert.equal(menu.slots.length, 4);
  for (const slot of menu.slots) {
    assert.ok(slot.options.length >= 1 && slot.options.length <= 3);
    const ids = slot.options.map((o) => o.dish.id);
    assert.equal(new Set(ids).size, ids.length, `повтор внутри приёма ${slot.id}`);
  }
});

test("блюда стараются не повторяться между приёмами, пока база позволяет", () => {
  const menu = buildDayMenu(NORM, 3, BASE);
  if (!menu.ok) assert.fail("меню должно строиться");
  const all = menu.slots.flatMap((s) => s.options.map((o) => o.dish.id));
  assert.equal(new Set(all).size, all.length);
});

test("завтрак не предлагает обед, даже если калории совпадают лучше", () => {
  const menu = buildDayMenu(NORM, 3, BASE);
  if (!menu.ok) assert.fail("меню должно строиться");
  const breakfast = menu.slots.find((s) => s.id === "breakfast");
  assert.ok(breakfast);
  assert.equal(breakfast.options[0].dish.kind, "breakfast");
});

test("меню детерминировано: одинаковый вход — одинаковый результат", () => {
  assert.deepEqual(buildDayMenu(NORM, 5, BASE), buildDayMenu(NORM, 5, BASE));
});

test("неверный число приёмов, норма или пустая база отклоняются", () => {
  assert.deepEqual(buildDayMenu(NORM, 2, BASE), { ok: false, reason: "count" });
  assert.deepEqual(buildDayMenu({ ...NORM, calories: 300 }, 3, BASE), { ok: false, reason: "target" });
  assert.deepEqual(buildDayMenu(NORM, 3, []), { ok: false, reason: "no-dishes" });
});

test("вариант помечается попаданием в ±10% по калориям", () => {
  // обед при норме 2400 — 40% = 960 ккал
  const menu = buildDayMenu(NORM, 3, [dish("exact", 960, 72, "lunch")]);
  if (!menu.ok) assert.fail("меню должно строиться");
  const lunch = menu.slots.find((s) => s.id === "lunch");
  assert.ok(lunch);
  assert.equal(lunch.options[0].within, true);
});

test("итог выбранных блюд и статус дня", () => {
  const menu = buildDayMenu(NORM, 3, BASE);
  if (!menu.ok) assert.fail("меню должно строиться");
  const selection: Record<string, string> = {};
  for (const slot of menu.slots) selection[slot.id] = slot.options[0].dish.id;
  const totals = dayTotals(selection, menu.slots, BASE);
  const expected = menu.slots.reduce((acc, s) => acc + (BASE.find((d) => d.id === selection[s.id])?.calories ?? 0), 0);
  assert.equal(totals.calories, expected);
  const status = dayStatus(totals, NORM);
  assert.ok(["ok", "low", "high"].includes(status.kcal));
});

test("статус дня: перебор, недобор и белок", () => {
  assert.deepEqual(dayStatus({ calories: 2400, protein: 180, fat: 0, carbs: 0 }, NORM), { kcal: "ok", protein: "ok" });
  assert.deepEqual(dayStatus({ calories: 2800, protein: 180, fat: 0, carbs: 0 }, NORM), { kcal: "high", protein: "ok" });
  assert.deepEqual(dayStatus({ calories: 1800, protein: 120, fat: 0, carbs: 0 }, NORM), { kcal: "low", protein: "low" });
});

test("неизвестное блюдо в выборе пропускается", () => {
  const menu = buildDayMenu(NORM, 3, BASE);
  if (!menu.ok) assert.fail("меню должно строиться");
  const totals = dayTotals({ breakfast: "нет-такого" }, menu.slots, BASE);
  assert.deepEqual(totals, { calories: 0, protein: 0, fat: 0, carbs: 0 });
});
