import { test } from "node:test";
import assert from "node:assert/strict";
import { DISH_RECIPES } from "../data/dish-recipes";
import { INGREDIENT_ALIASES } from "../data/ingredient-aliases";
import { aliasFor, matchIngredient } from "./ingredient-match";
import { parseDish } from "./recipe-text";

// Небольшой набор в духе справочника USDA (английские названия).
const usda = [
  { id: "ch-breast", name: "Chicken, broilers or fryers, breast, meat only, raw" },
  { id: "ch-thigh", name: "Chicken, broilers or fryers, thigh, meat only, raw" },
  { id: "oats", name: "Oats" },
  { id: "oil-olive", name: "Oil, olive, salad or cooking" },
  { id: "salt", name: "Salt, table" },
  { id: "pepper-black", name: "Spices, pepper, black" },
  { id: "pepper-red", name: "Peppers, sweet, red, raw" },
  { id: "pepper-green", name: "Peppers, sweet, green, raw" },
];

test("словарь полный: каждое название из рецептов каталога имеет перевод", () => {
  const missing = new Set<string>();
  for (const recipe of Object.values(DISH_RECIPES)) {
    for (const item of parseDish(recipe).ingredients) {
      if (aliasFor(item.name) === null) missing.add(item.name);
    }
  }
  assert.deepEqual([...missing], [], `нет перевода: ${[...missing].join(", ")}`);
});

test("в словаре нет дублей по русскому названию", () => {
  const keys = INGREDIENT_ALIASES.map((a) => a.ru.toLowerCase().replace(/ё/g, "е"));
  assert.equal(new Set(keys).size, keys.length);
});

test("каждый перевод содержит хотя бы один английский термин", () => {
  for (const alias of INGREDIENT_ALIASES) {
    assert.ok(alias.en.length > 0 && alias.en.every((t) => t.trim().length > 0), `пустой перевод: ${alias.ru}`);
  }
});

test("подбор по переводу: все слова термина должны быть в записи", () => {
  assert.deepEqual(matchIngredient("Куриная грудка", usda), { kind: "candidates", ids: ["ch-breast"] });
  assert.deepEqual(matchIngredient("Оливковое масло", usda), { kind: "candidates", ids: ["oil-olive"] });
  assert.deepEqual(matchIngredient("Соль", usda), { kind: "candidates", ids: ["salt"] });
});

test("чёрный перец находит приправу; болгарский перец — оба сорта", () => {
  assert.deepEqual(matchIngredient("Чёрный перец", usda), { kind: "candidates", ids: ["pepper-black"] });
  assert.deepEqual(matchIngredient("Болгарский перец", usda), { kind: "candidates", ids: ["pepper-red", "pepper-green"] });
});

test("точное совпадение с русским названием (записи тренера) важнее перевода", () => {
  const catalog = [{ id: "m1", name: "Куриная грудка" }, ...usda];
  assert.deepEqual(matchIngredient("Куриная грудка", catalog), { kind: "exact", id: "m1" });
});

test("нет перевода или нет подходящих записей — none, без подстановки", () => {
  assert.deepEqual(matchIngredient("Ананас", usda), { kind: "none" });
  assert.deepEqual(matchIngredient("Творог 5%", usda), { kind: "none" });
});
