/**
 * Разбор текстов рецептов (dish-recipes.ts) в структуру: название, количество, единица, состояние и флаги.
 * Ничего не угадывает: неясное помечается флагом, решение за тренером. Продукт из справочника не выбирается.
 * Чистые функции, без БД и сети. Тесты — recipe-text.test.ts.
 */
import type { DishRecipe } from "../data/dish-recipes";
import type { FoodState } from "./food-reference-rules";

export type IngredientUnit = "g" | "ml" | "pcs" | "tsp" | "pinch" | "none";

export type IngredientFlag =
  /** Количества нет: «Сок лайма», «Соль, перец». Такой ингредиент в граммах не считается. */
  | "no-amount"
  /** Строка перечисляет несколько продуктов через запятую; разделены автоматически. */
  | "list"
  /** Внутри строки «A и B» / «A или B»: какой продукт брать, решает тренер. */
  | "combined"
  /** Штуки: без массы одной штуки в граммы не переводятся. */
  | "pcs"
  /** Ч. л.: нужен коэффициент плотности. */
  | "tsp"
  /** Щепотка: массы нет. */
  | "pinch"
  /** Количество указано, но единица не распознана. */
  | "amount-unclear"
  /** Есть количество в граммах или мл, а состояние (сырой, варёный, жареный, сухой) не указано. */
  | "state-missing";

export type ParsedIngredient = {
  raw: string;
  name: string;
  state: FoodState | null;
  amount: number | null;
  unit: IngredientUnit;
  optional: boolean;
  flags: IngredientFlag[];
};

export type ParsedDish = {
  ingredients: ParsedIngredient[];
  steps: string[];
  /** Сколько ингредиентов требуют внимания тренера. */
  flagged: number;
};

const EM_DASH = " — ";

// Границы слова с кириллицей: \b в JS видит только ASCII, поэтому используем \p{L}.
const STATE_PATTERNS: [FoodState, RegExp][] = [
  ["raw", /(?<!\p{L})(сырая|сырой|сырое|сырые)(?!\p{L})/iu],
  ["dry", /(?<!\p{L})(сухая|сухой|сухое|сухие)(?!\p{L})/iu],
  ["cooked", /(?<!\p{L})(отварная|отварной|отварное|отварные|варёная|варёный|варёное|варёные)(?!\p{L})/iu],
  ["fried", /(?<!\p{L})(жареная|жареный|жареное|жареные)(?!\p{L})/iu],
];

const COMBINED = /(?<!\p{L})(и|или)(?!\p{L})/iu;

function capitalize(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function cleanSpaces(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/[ ,]+$/g, "").trim();
}

/** Делит по запятым верхнего уровня: запятые внутри скобок не трогаем. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseTail(tail: string): { amount: number | null; unit: IngredientUnit; flag: IngredientFlag | null } {
  const weight = /^(\d+(?:[.,]\d+)?)\s*(г|мл|шт)\.?$/i.exec(tail);
  if (weight) {
    const value = Number(weight[1].replace(",", "."));
    const unit = weight[2].toLowerCase();
    if (unit === "г") return { amount: value, unit: "g", flag: null };
    if (unit === "мл") return { amount: value, unit: "ml", flag: null };
    return { amount: value, unit: "pcs", flag: "pcs" };
  }
  const spoon = /^(½|\d+(?:[.,]\d+)?)\s*ч\.\s*л\.?$/i.exec(tail);
  if (spoon) {
    const value = spoon[1] === "½" ? 0.5 : Number(spoon[1].replace(",", "."));
    return { amount: value, unit: "tsp", flag: "tsp" };
  }
  if (/^щепотка$/i.test(tail)) return { amount: null, unit: "pinch", flag: "pinch" };
  return { amount: null, unit: "none", flag: "amount-unclear" };
}

/** Один фрагмент названия: вынимает состояние, если оно названо словом. */
function extractState(name: string): { name: string; state: FoodState | null } {
  for (const [state, pattern] of STATE_PATTERNS) {
    const match = pattern.exec(name);
    if (match) {
      return { name: cleanSpaces(name.replace(pattern, " ")), state };
    }
  }
  return { name: cleanSpaces(name), state: null };
}

/**
 * Разбор одной строки рецепта. Строка без количества, перечисляющая продукты через запятую,
 * превращается в несколько ингредиентов без количества (соль, перец, укроп…).
 */
export function parseIngredientLine(raw: string): ParsedIngredient[] {
  const original = raw.trim();
  const optional = /,?\s*по желанию\.?$/i.test(original);
  const text = original.replace(/,?\s*по желанию\.?$/i, "").trim();

  const dash = text.lastIndexOf(EM_DASH);
  const head = dash > 0 ? text.slice(0, dash) : text;
  const tail = dash > 0 ? text.slice(dash + EM_DASH.length).trim() : null;

  if (tail === null) {
    const parts = splitTopLevel(head);
    const isList = parts.length > 1;
    return parts.map((part) => {
      const { name, state } = extractState(part);
      const flags: IngredientFlag[] = ["no-amount"];
      if (isList) flags.push("list");
      return { raw: original, name: capitalize(name), state, amount: null, unit: "none", optional, flags };
    });
  }

  const { name, state } = extractState(head);
  const { amount, unit, flag } = parseTail(tail);
  const flags: IngredientFlag[] = [];
  if (flag) flags.push(flag);
  if (COMBINED.test(name.replace(/\([^)]*\)/g, " "))) flags.push("combined");
  if (amount !== null && state === null) flags.push("state-missing");
  return [{ raw: original, name: capitalize(name), state, amount, unit, optional, flags }];
}

/** Разбор всего рецепта блюда. Шаги копируются как есть. */
export function parseDish(recipe: DishRecipe): ParsedDish {
  const ingredients = recipe.ingredients.flatMap(parseIngredientLine);
  const flagged = ingredients.filter((i) => i.flags.length > 0).length;
  return { ingredients, steps: [...recipe.steps], flagged };
}

export type CatalogItem = { id: string; name: string };

export type MatchResult =
  | { kind: "exact"; id: string }
  | { kind: "candidates"; ids: string[] }
  | { kind: "none" };

/** Нормализация для сравнения: нижний регистр, ё→е, без скобок и знаков, одинарные пробелы. */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}%\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_CANDIDATES = 10;

/**
 * Подсказка по справочнику: точное совпадение, либо список вариантов, где название справочника содержит запрос.
 * Не выбирает продукт сама при неоднозначности: решение за тренером.
 */
export function matchCatalog(name: string, catalog: CatalogItem[]): MatchResult {
  const query = normalizeName(name);
  if (query.length < 3) return { kind: "none" };
  const exact = catalog.filter((item) => normalizeName(item.name) === query);
  if (exact.length === 1) return { kind: "exact", id: exact[0].id };
  if (exact.length > 1) return { kind: "candidates", ids: exact.slice(0, MAX_CANDIDATES).map((i) => i.id) };
  const near = catalog.filter((item) => normalizeName(item.name).includes(query));
  if (near.length === 0) return { kind: "none" };
  return { kind: "candidates", ids: near.slice(0, MAX_CANDIDATES).map((i) => i.id) };
}
