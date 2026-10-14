import { test } from "node:test";
import assert from "node:assert/strict";
import { DISH_RECIPES } from "../data/dish-recipes";
import { matchCatalog, normalizeName, parseDish, parseIngredientLine } from "./recipe-text";

const one = (line: string) => {
  const items = parseIngredientLine(line);
  assert.equal(items.length, 1, `ожидался один ингредиент: ${line}`);
  return items[0];
};

test("граммы: название, количество и единица; состояние не указано — флаг", () => {
  const item = one("Овсянка — 55 г");
  assert.equal(item.name, "Овсянка");
  assert.equal(item.amount, 55);
  assert.equal(item.unit, "g");
  assert.equal(item.state, null);
  assert.deepEqual(item.flags, ["state-missing"]);
});

test("запятая и проценты в названии не ломают разбор", () => {
  const item = one("Молоко 2,5% — 130 мл");
  assert.equal(item.name, "Молоко 2,5%");
  assert.equal(item.amount, 130);
  assert.equal(item.unit, "ml");
});

test("штуки: количество есть, перевод в граммы не выполняется — флаг pcs", () => {
  const item = one("Яйца — 2 шт.");
  assert.equal(item.unit, "pcs");
  assert.equal(item.amount, 2);
  assert.ok(item.flags.includes("pcs"));
});

test("щепотка: без количества, флаг pinch", () => {
  const item = one("Соль — щепотка");
  assert.equal(item.name, "Соль");
  assert.equal(item.unit, "pinch");
  assert.equal(item.amount, null);
  assert.deepEqual(item.flags, ["pinch"]);
});

test("половина чайной ложки: дробь ½ распознаётся, нужна плотность — флаг tsp", () => {
  const item = one("Горчица — ½ ч. л.");
  assert.equal(item.unit, "tsp");
  assert.equal(item.amount, 0.5);
  assert.ok(item.flags.includes("tsp"));
});

test("«по желанию» — отдельная отметка, количество сохраняется", () => {
  const item = one("Мёд — 10 г, по желанию");
  assert.equal(item.optional, true);
  assert.equal(item.name, "Мёд");
  assert.equal(item.amount, 10);
});

test("перечисление без количеств делится на отдельные продукты с флагом list", () => {
  const items = parseIngredientLine("Соль, перец");
  assert.deepEqual(items.map((i) => i.name), ["Соль", "Перец"]);
  for (const item of items) {
    assert.equal(item.amount, null);
    assert.ok(item.flags.includes("list"));
    assert.ok(item.flags.includes("no-amount"));
  }
});

test("одиночный продукт без количества: только no-amount, без list", () => {
  const item = one("Сок лайма");
  assert.equal(item.amount, null);
  assert.deepEqual(item.flags, ["no-amount"]);
});

test("состояние из названия: сырой, сухой, отварной выносятся в поле state", () => {
  assert.equal(one("Лосось филе сырой — 150 г").state, "raw");
  assert.equal(one("Лосось филе сырой — 150 г").name, "Лосось филе");
  assert.equal(one("Рис сухой — 60 г").state, "dry");
  assert.equal(one("Рис отварной — 150 г").state, "cooked");
  assert.equal(one("Гречка сухая — 100 г").name, "Гречка");
  assert.deepEqual(one("Гречка сухая — 100 г").flags, []);
});

test("скобки с запятой и словом «или» внутри не считаются составной строкой", () => {
  const item = one("Говядина (лопатка или вырезка, до 10% жира) сырая — 200 г");
  assert.equal(item.name, "Говядина (лопатка или вырезка, до 10% жира)");
  assert.equal(item.state, "raw");
  assert.ok(!item.flags.includes("combined"));
});

test("«A и B» и «A или B» с количеством — флаг combined, строка не делится", () => {
  const and = one("Перец болгарский и брокколи — 150 г");
  assert.ok(and.flags.includes("combined"));
  assert.equal(and.amount, 150);
  assert.ok(one("Брокколи или стручковая фасоль — 100 г").flags.includes("combined"));
});

test("неизвестная единица — флаг amount-unclear, количество не придумывается", () => {
  const item = one("Соус — по вкусу");
  assert.equal(item.unit, "none");
  assert.equal(item.amount, null);
  assert.ok(item.flags.includes("amount-unclear"));
});

test("список из четырёх продуктов делится на четыре ингредиента", () => {
  assert.equal(parseIngredientLine("Лимон, укроп, соль, перец").length, 4);
});

test("миллилитры: единица ml, без перевода в граммы", () => {
  const item = one("Соевый соус — 10 мл");
  assert.equal(item.unit, "ml");
  assert.equal(item.amount, 10);
});

test("весь текст каталога разбирается без потерь: каждый ингредиент с именем и флагами", () => {
  let flagged = 0;
  for (const [id, recipe] of Object.entries(DISH_RECIPES)) {
    const parsed = parseDish(recipe);
    assert.ok(parsed.ingredients.length >= recipe.ingredients.length, `потеря строк: ${id}`);
    assert.equal(parsed.steps.length, recipe.steps.length, `шаги изменены: ${id}`);
    for (const item of parsed.ingredients) {
      assert.ok(item.name.length >= 2, `пустое название в ${id}: ${item.raw}`);
      assert.equal(item.amount !== null, ["g", "ml", "pcs", "tsp"].includes(item.unit), `количество не сходится с единицей: ${item.raw}`);
    }
    flagged += parsed.flagged;
  }
  assert.ok(flagged > 0, "флаги для проверки тренером должны быть");
});

test("нормализация: регистр, ё и скобки не мешают сравнению", () => {
  assert.equal(normalizeName("Ёжик (фермерский)"), "ежик");
  assert.equal(normalizeName("  Творог  5% "), "творог 5%");
});

test("подбор: точное совпадение — один вариант", () => {
  const catalog = [{ id: "a", name: "Творог 5%" }, { id: "b", name: "Творог 9%" }];
  assert.deepEqual(matchCatalog("творог 5%", catalog), { kind: "exact", id: "a" });
});

test("подбор: несколько похожих — список вариантов, выбор не делается", () => {
  const catalog = [{ id: "o", name: "Масло оливковое" }, { id: "s", name: "Масло сливочное" }, { id: "m", name: "Молоко" }];
  assert.deepEqual(matchCatalog("Масло", catalog), { kind: "candidates", ids: ["o", "s"] });
});

test("подбор: нет похожих или запрос слишком короткий — none", () => {
  const catalog = [{ id: "u", name: "Уксус" }];
  assert.deepEqual(matchCatalog("Бальзамик", catalog), { kind: "none" });
  assert.deepEqual(matchCatalog("Ос", catalog), { kind: "none" });
});
