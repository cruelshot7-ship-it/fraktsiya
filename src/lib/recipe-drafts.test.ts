import { test } from "node:test";
import assert from "node:assert/strict";
import { DISH_RECIPES } from "../data/dish-recipes";
import { buildDraft, draftProgress, DRAFT_SERVINGS, toIngredient } from "./recipe-drafts";
import { ingredientNutrients, recipeNutrition } from "./recipe-calc";
import { parseIngredientLine } from "./recipe-text";

const oatsDish = { ingredients: ["Овсянка — 55 г", "Яйца — 2 шт.", "Соль — щепотка"], steps: ["Варить."] };

test("каждое блюдо каталога становится черновиком: статус draft, одна порция", () => {
  for (const [id, dish] of Object.entries(DISH_RECIPES)) {
    const draft = buildDraft(id, id, dish);
    assert.equal(draft.recipe.status, "draft", id);
    assert.equal(draft.recipe.servings, DRAFT_SERVINGS, id);
    assert.equal(draft.recipe.yieldGrams, null, id);
  }
});

test("ингредиенты: число и идентификаторы совпадают с разбором, идентификаторы уникальны", () => {
  for (const [id, dish] of Object.entries(DISH_RECIPES)) {
    const draft = buildDraft(id, id, dish);
    const expected = dish.ingredients.flatMap((line) => parseIngredientLine(line)).length;
    assert.equal(draft.recipe.ingredients.length, expected, id);
    const ids = draft.recipe.ingredients.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, id);
    for (const i of draft.recipe.ingredients) assert.ok(draft.suggestions[i.id], `нет подсказки: ${i.id}`);
  }
});

test("граммы переносятся в движок, штуки и щепотка — без количества", () => {
  const draft = buildDraft("oats", "Овсянка", oatsDish);
  const [oats, eggs, salt] = draft.recipe.ingredients;
  assert.equal(oats.amount, 55);
  assert.equal(oats.unit, "g");
  assert.equal(eggs.amount, null);
  assert.equal(salt.amount, null);
});

test("состояние из текста попадает в ингредиент; без состояния — unknown", () => {
  const draft = buildDraft("salmon", "Лосось", { ingredients: ["Лосось филе сырой — 150 г", "Масло — 5 г"], steps: [] });
  assert.equal(draft.recipe.ingredients[0].state, "raw");
  assert.equal(draft.recipe.ingredients[1].state, "unknown");
});

test("без привязанных продуктов черновик неполный: каждый ингредиент — no-product", () => {
  const draft = buildDraft("oats", "Овсянка", oatsDish);
  const nutrition = recipeNutrition(draft.recipe);
  assert.equal(nutrition.complete, false);
  assert.equal(nutrition.totals, null);
  assert.ok(nutrition.issues.every((i) => i.issue === "no-product"));
  assert.deepEqual(draftProgress(draft), { total: 3, missingProduct: 3 });
});

test("после привязки продукта граммы считаются движком", () => {
  const per100 = { kcal: 380, protein: 13, fat: 7, carbs: 66, fiber: 10 };
  const [oats] = buildDraft("oats", "Овсянка", { ingredients: ["Овсянка — 55 г"], steps: [] }).recipe.ingredients;
  const linked = toIngredient({ raw: "", name: "Овсянка", state: "dry", amount: 55, unit: "g", optional: false, flags: [] }, oats.id, per100);
  const n = ingredientNutrients(linked);
  assert.ok(n);
  assert.ok(Math.abs(n.kcal - 209) < 1e-9);
});

test("подсказки по справочнику: найденная запись попадает в предложения, выбор не делается", () => {
  const catalog = [{ id: "ch", name: "Chicken, broilers or fryers, breast, meat only, raw" }];
  const draft = buildDraft("bowl", "Боул", { ingredients: ["Куриная грудка сырая — 200 г"], steps: [] }, catalog);
  assert.deepEqual(draft.suggestions["bowl-1"], { kind: "candidates", ids: ["ch"] });
  assert.equal(draft.recipe.ingredients[0].per100, null);
});
