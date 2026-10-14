import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  ingredientIssue,
  ingredientNutrients,
  perPortion,
  per100OfYield,
  recipeNutrition,
  replaceIngredient,
  verifyBlocker,
  type Recipe,
  type RecipeIngredient,
} from "./recipe-calc";

const rice = (over: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: "rice",
  name: "Рис",
  state: "dry",
  unit: "g",
  amount: 200,
  density: null,
  per100: { kcal: 100, protein: 10, fat: 5, carbs: 20, fiber: 2 },
  ...over,
});

const oil = (over: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  id: "oil",
  name: "Масло",
  state: "raw",
  unit: "g",
  amount: 100,
  density: null,
  per100: { kcal: 50, protein: 0, fat: 5, carbs: 10, fiber: 0 },
  ...over,
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "r1",
  name: "Тест",
  status: "draft",
  servings: 2,
  yieldGrams: 500,
  ingredients: [rice(), oil()],
  ...over,
});

test("сумма ингредиентов: показатель на 100 г × масса / 100, рецепт — сумма", () => {
  const r = recipeNutrition(recipe());
  assert.equal(r.complete, true);
  // рис 200 г: 200 ккал, Б 20, Ж 10, У 40, клетчатка 4; масло 100 г: 50 ккал, Ж 5, У 10, клетчатка 0
  assert.deepEqual(r.totals, { kcal: 250, protein: 20, fat: 15, carbs: 50, fiber: 4 });
});

test("порция: сумма делится на число порций", () => {
  const r = recipeNutrition(recipe({ servings: 2 }));
  assert.equal(r.perPortion?.kcal, 125);
  assert.equal(r.perPortion?.protein, 10);
});

test("смена порций пересчитывает всё: та же сумма, другая порция", () => {
  const four = recipeNutrition(recipe({ servings: 4 }));
  assert.equal(four.totals?.kcal, 250);
  assert.equal(four.perPortion?.kcal, 62.5);
  assert.equal(four.perPortion?.fiber, 1);
});

test("100 г готового блюда: сумма × 100 / масса готового", () => {
  const r = recipeNutrition(recipe({ yieldGrams: 500 }));
  assert.equal(r.per100Yield?.kcal, 50);
  assert.equal(r.per100Yield?.protein, 4);
});

test("масса готового неизвестна или не положительна — 100 г не показывается", () => {
  assert.equal(recipeNutrition(recipe({ yieldGrams: null })).per100Yield, null);
  assert.equal(recipeNutrition(recipe({ yieldGrams: 0 })).per100Yield, null);
  assert.equal(recipeNutrition(recipe({ yieldGrams: -10 })).per100Yield, null);
});

test("ноль граммов — ингредиент с ошибкой, рецепт неполный, сумма не показывается", () => {
  const r = recipeNutrition(recipe({ ingredients: [rice({ amount: 0 })] }));
  assert.equal(r.complete, false);
  assert.deepEqual(r.issues, [{ id: "rice", issue: "bad-amount" }]);
  assert.equal(r.totals, null);
  assert.equal(r.perPortion, null);
});

test("пустой ингредиент (продукт не выбран) — «no-product», рецепт неполный", () => {
  const empty = rice({ per100: null, amount: null });
  assert.equal(ingredientIssue(empty), "no-product");
  const r = recipeNutrition(recipe({ ingredients: [oil(), empty] }));
  assert.equal(r.complete, false);
  assert.deepEqual(r.issues, [{ id: "rice", issue: "no-product" }]);
});

test("масса не задана — «no-amount», а не ноль", () => {
  assert.equal(ingredientIssue(rice({ amount: null })), "no-amount");
  assert.equal(ingredientNutrients(rice({ amount: null })), null);
});

test("состояние «не указано» не входит в расчёт и делает рецепт неполным", () => {
  const r = recipeNutrition(recipe({ ingredients: [rice({ state: "unknown" }), oil()] }));
  assert.equal(r.complete, false);
  assert.deepEqual(r.issues, [{ id: "rice", issue: "unknown-state" }]);
});

test("пустое значение КБЖУ не считается нулём", () => {
  const r = recipeNutrition(recipe({ ingredients: [rice({ per100: { kcal: 100, protein: 10, fat: null, carbs: 20, fiber: 2 } })] }));
  assert.equal(r.complete, false);
  assert.deepEqual(r.issues, [{ id: "rice", issue: "no-values" }]);
  assert.equal(r.totals, null);
});

test("клетчатка неизвестна у одного ингредиента — итог клетчатки null, калории считаются", () => {
  const noFiber = oil({ per100: { kcal: 50, protein: 0, fat: 5, carbs: 10, fiber: null } });
  const r = recipeNutrition(recipe({ ingredients: [rice(), noFiber] }));
  assert.equal(r.complete, true);
  assert.equal(r.totals?.kcal, 250);
  assert.equal(r.totals?.fiber, null);
  assert.equal(r.perPortion?.fiber, null);
});

test("миллилитры без плотности не переводятся в граммы", () => {
  const milk = oil({ id: "milk", unit: "ml", amount: 200, density: null });
  assert.equal(ingredientIssue(milk), "no-density");
});

test("миллилитры с плотностью: граммы = мл × плотность", () => {
  const milk = oil({ id: "milk", unit: "ml", amount: 200, density: 1.03, per100: { kcal: 50, protein: 3, fat: 2, carbs: 5, fiber: 0 } });
  const n = ingredientNutrients(milk);
  assert.ok(n);
  assert.ok(Math.abs(n.kcal - 103) < 1e-9);
});

test("замена ингредиента по id пересчитывает рецепт", () => {
  const list = [rice(), oil()];
  const swapped = replaceIngredient(list, "oil", oil({ amount: 0 }));
  assert.equal(recipeNutrition(recipe({ ingredients: swapped })).complete, false);
  assert.deepEqual(replaceIngredient(list, "missing", oil()), list);
});

test("пустой рецепт — «empty», без суммы", () => {
  const r = recipeNutrition(recipe({ ingredients: [] }));
  assert.equal(r.complete, false);
  assert.deepEqual(r.recipeIssues, ["empty"]);
  assert.equal(r.totals, null);
});

test("порция: только целое число от 1 до 50", () => {
  const totals = { kcal: 100, protein: 10, fat: 5, carbs: 10, fiber: 1 };
  assert.equal(perPortion(totals, 0), null);
  assert.equal(perPortion(totals, 1.5), null);
  assert.equal(perPortion(totals, 51), null);
  assert.equal(perPortion(totals, 50)?.kcal, 2);
  const bad = recipeNutrition(recipe({ servings: 0 }));
  assert.deepEqual(bad.recipeIssues, ["bad-servings"]);
  assert.equal(bad.perPortion, null);
});

test("100 г готового: нулевая масса не даёт деления на ноль", () => {
  assert.equal(per100OfYield({ kcal: 1, protein: 0, fat: 0, carbs: 0, fiber: 0 }, 0), null);
});

test("переход статусов: проверка только через needs_review", () => {
  assert.equal(canTransition("draft", "verified"), false);
  assert.equal(canTransition("draft", "needs_review"), true);
  assert.equal(canTransition("needs_review", "verified"), true);
  assert.equal(canTransition("archived", "verified"), false);
  assert.equal(canTransition("verified", "archived"), true);
});

test("проверка блокируется для неполного рецепта", () => {
  assert.equal(verifyBlocker(recipe()), null);
  assert.equal(verifyBlocker(recipe({ ingredients: [rice({ amount: null })] })), "incomplete");
});
