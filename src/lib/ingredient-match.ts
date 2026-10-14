/**
 * Подбор записей справочника по названию продукта из рецепта: русский переход через словарь, затем поиск по английским терминам.
 * Чистые функции, без БД. Тесты — ingredient-match.test.ts. Выбор записи делает тренер.
 */
import { INGREDIENT_ALIASES, type IngredientAlias } from "../data/ingredient-aliases";
import { matchCatalog, normalizeName, type CatalogItem, type MatchResult } from "./recipe-text";

const MAX_CANDIDATES = 10;

const aliasIndex = new Map<string, IngredientAlias>(INGREDIENT_ALIASES.map((a) => [normalizeName(a.ru), a]));

/** Словарная запись для названия из рецепта. null — перевода нет. */
export function aliasFor(name: string): IngredientAlias | null {
  return aliasIndex.get(normalizeName(name)) ?? null;
}

/** Грубая нормализация множественного числа: tomatoes→tomato, peppers→pepper, blueberries→blueberry. */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function tokens(text: string): string[] {
  return normalizeName(text)
    .split(/[\s,]+/)
    .filter((t) => t.length > 0)
    .map(stem);
}

/** Запись подходит, если в её названии есть все слова термина (порядок не важен). */
function containsAllTokens(entryName: string, term: string): boolean {
  const entry = new Set(tokens(entryName));
  return tokens(term).every((t) => entry.has(t));
}

/**
 * Подбор: сначала точное совпадение с русским названием (записи тренера), затем по английским терминам USDA.
 * Несколько вариантов — список, один — всё равно подсказка, а не выбор.
 */
export function matchIngredient(name: string, catalog: CatalogItem[]): MatchResult {
  const direct = matchCatalog(name, catalog);
  if (direct.kind !== "none") return direct;

  const alias = aliasFor(name);
  if (!alias) return { kind: "none" };

  const hits = catalog.filter((item) => alias.en.some((term) => containsAllTokens(item.name, term)));
  if (hits.length === 0) return { kind: "none" };
  return { kind: "candidates", ids: hits.slice(0, MAX_CANDIDATES).map((i) => i.id) };
}
