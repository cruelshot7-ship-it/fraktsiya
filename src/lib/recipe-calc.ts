/**
 * Единый движок расчёта рецептов: ингредиент, рецепт, порция, 100 г готового блюда, статусы.
 * Чистые функции, без БД и сети. Тесты — recipe-calc.test.ts.
 *
 * Правила из плана (N1.4):
 * - показатель ингредиента = показатель на 100 г × масса / 100; рецепт = сумма ингредиентов;
 * - отсутствующее значение остаётся null и не становится нулём: рецепт с пробелом — «неполный»;
 * - миллилитры переводятся в граммы только с явным коэффициентом плотности;
 * - КБЖУ на 100 г готового блюда — только при известной массе готового блюда.
 * Формулы живут здесь: интерфейс, API и генератор используют только этот модуль.
 */
import type { FoodState, Per100 } from "./food-reference-rules";

export const RECIPE_STATUSES = ["draft", "needs_review", "verified", "archived"] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

/** Порций в одном рецепте: разумный предел, чтобы опечатка не давала абсурдных значений. */
export const MAX_SERVINGS = 50;

export type Nutrients = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** null, если клетчатка неизвестна хотя бы у одного ингредиента. */
  fiber: number | null;
};

export type RecipeIngredient = {
  id: string;
  name: string;
  state: FoodState;
  unit: "g" | "ml";
  /** Количество в единице `unit`. null — не задано. */
  amount: number | null;
  /** Плотность, г/мл. Нужна только для единицы `ml`. */
  density: number | null;
  /** Показатели из справочника на 100 г. null — продукт не выбран. */
  per100: Per100 | null;
};

export type IngredientIssue =
  | "no-product"
  | "unknown-state"
  | "no-amount"
  | "bad-amount"
  | "no-density"
  | "no-values";

export type Recipe = {
  id: string;
  name: string;
  status: RecipeStatus;
  servings: number;
  /** Масса готового блюда, г. null — неизвестна. */
  yieldGrams: number | null;
  ingredients: RecipeIngredient[];
};

export type IngredientIssueRow = { id: string; issue: IngredientIssue };

export type RecipeNutrition = {
  /** Все ингредиенты в порядке, и рецепт не пуст. */
  complete: boolean;
  issues: IngredientIssueRow[];
  /** Пустой рецепт или неверная порция — отдельные причины неполноты. */
  recipeIssues: ("empty" | "bad-servings")[];
  /** Сумма по рецепту. null, если рецепт неполный. */
  totals: Nutrients | null;
  /** Одна порция. null, если рецепт неполный или порция неверна. */
  perPortion: Nutrients | null;
  /** На 100 г готового блюда. null, если масса готового неизвестна. */
  per100Yield: Nutrients | null;
};

const finitePositive = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

/** Масса ингредиента в граммах, либо причина, почему её нельзя определить. */
export function ingredientGrams(
  ing: RecipeIngredient,
): { ok: true; grams: number } | { ok: false; issue: IngredientIssue } {
  if (ing.amount === null) return { ok: false, issue: "no-amount" };
  if (!finitePositive(ing.amount)) return { ok: false, issue: "bad-amount" };
  if (ing.unit === "g") return { ok: true, grams: ing.amount };
  if (!finitePositive(ing.density)) return { ok: false, issue: "no-density" };
  return { ok: true, grams: ing.amount * ing.density };
}

/** Что мешает учесть ингредиент в расчёте. null — ингредиент полный. */
export function ingredientIssue(ing: RecipeIngredient): IngredientIssue | null {
  if (ing.per100 === null) return "no-product";
  if (ing.state === "unknown") return "unknown-state";
  const grams = ingredientGrams(ing);
  if (!grams.ok) return grams.issue;
  const p = ing.per100;
  if (p.kcal === null || p.protein === null || p.fat === null || p.carbs === null) return "no-values";
  return null;
}

/** Показатели ингредиента: значение на 100 г × масса / 100. null, если ингредиент неполный. */
export function ingredientNutrients(ing: RecipeIngredient): Nutrients | null {
  if (ingredientIssue(ing) !== null || ing.per100 === null) return null;
  const grams = ingredientGrams(ing);
  if (!grams.ok) return null;
  const k = grams.grams / 100;
  const p = ing.per100;
  return {
    kcal: (p.kcal as number) * k,
    protein: (p.protein as number) * k,
    fat: (p.fat as number) * k,
    carbs: (p.carbs as number) * k,
    fiber: p.fiber === null ? null : p.fiber * k,
  };
}

function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber === null || b.fiber === null ? null : a.fiber + b.fiber,
  };
}

const ZERO: Nutrients = { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };

/** Сумма ингредиентов. null, если хотя бы один ингредиент неполный или список пуст. */
export function sumIngredients(ingredients: RecipeIngredient[]): Nutrients | null {
  if (ingredients.length === 0) return null;
  let total: Nutrients = ZERO;
  for (const ing of ingredients) {
    const part = ingredientNutrients(ing);
    if (part === null) return null;
    total = addNutrients(total, part);
  }
  return total;
}

/** Порция: сумма / число порций. null, если порции не целое число от 1 до MAX_SERVINGS. */
export function perPortion(totals: Nutrients, servings: number): Nutrients | null {
  if (!Number.isInteger(servings) || servings < 1 || servings > MAX_SERVINGS) return null;
  return {
    kcal: totals.kcal / servings,
    protein: totals.protein / servings,
    fat: totals.fat / servings,
    carbs: totals.carbs / servings,
    fiber: totals.fiber === null ? null : totals.fiber / servings,
  };
}

/** На 100 г готового блюда. null, если масса готового неизвестна или не положительна. */
export function per100OfYield(totals: Nutrients, yieldGrams: number | null): Nutrients | null {
  if (!finitePositive(yieldGrams)) return null;
  const k = 100 / yieldGrams;
  return {
    kcal: totals.kcal * k,
    protein: totals.protein * k,
    fat: totals.fat * k,
    carbs: totals.carbs * k,
    fiber: totals.fiber === null ? null : totals.fiber * k,
  };
}

/** Полный расчёт рецепта. Всё считается заново из ингредиентов: порции меняют результат автоматически. */
export function recipeNutrition(recipe: Recipe): RecipeNutrition {
  const issues: IngredientIssueRow[] = [];
  for (const ing of recipe.ingredients) {
    const issue = ingredientIssue(ing);
    if (issue !== null) issues.push({ id: ing.id, issue });
  }
  const recipeIssues: RecipeNutrition["recipeIssues"] = [];
  if (recipe.ingredients.length === 0) recipeIssues.push("empty");
  const servingsOk = Number.isInteger(recipe.servings) && recipe.servings >= 1 && recipe.servings <= MAX_SERVINGS;
  if (!servingsOk) recipeIssues.push("bad-servings");

  const totals = issues.length === 0 && recipeIssues.length === 0 ? sumIngredients(recipe.ingredients) : null;
  const complete = totals !== null;
  return {
    complete,
    issues,
    recipeIssues,
    totals,
    perPortion: totals !== null ? perPortion(totals, recipe.servings) : null,
    per100Yield: totals !== null ? per100OfYield(totals, recipe.yieldGrams) : null,
  };
}

/** Замена ингредиента по id. Если такого нет, список возвращается без изменений. */
export function replaceIngredient(ingredients: RecipeIngredient[], id: string, next: RecipeIngredient): RecipeIngredient[] {
  return ingredients.map((ing) => (ing.id === id ? next : ing));
}

const TRANSITIONS: Record<RecipeStatus, RecipeStatus[]> = {
  draft: ["needs_review", "archived"],
  needs_review: ["verified", "draft", "archived"],
  verified: ["needs_review", "archived"],
  archived: ["draft"],
};

export function canTransition(from: RecipeStatus, to: RecipeStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Причина, по которой рецепт нельзя отметить проверенным. null — можно. */
export function verifyBlocker(recipe: Recipe): "incomplete" | null {
  return recipeNutrition(recipe).complete ? null : "incomplete";
}
