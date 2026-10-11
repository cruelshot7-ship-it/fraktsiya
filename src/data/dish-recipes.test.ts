import assert from "node:assert/strict";
import test from "node:test";
import { MEALS } from "./studio.ts";
import { DISH_RECIPES } from "./dish-recipes.ts";

test("каждое блюдо каталога имеет рецепт с ингредиентами и шагами", () => {
  for (const meal of MEALS) {
    const r = DISH_RECIPES[meal.id];
    assert.ok(r, `нет рецепта: ${meal.id}`);
    assert.ok(r.ingredients.length >= 2, `мало ингредиентов: ${meal.id}`);
    assert.ok(r.steps.length >= 1, `нет шагов: ${meal.id}`);
  }
});

test("рецепты не описывают блюда, которых нет в каталоге", () => {
  const ids = new Set(MEALS.map((m) => m.id));
  for (const id of Object.keys(DISH_RECIPES)) assert.ok(ids.has(id), `лишний рецепт: ${id}`);
});
