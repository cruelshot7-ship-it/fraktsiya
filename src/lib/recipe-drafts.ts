/**
 * Черновики рецептов из текстов блюд (dish-recipes.ts) в структуре движка N1.4.
 * Все черновики — статус `draft`, продукты не привязаны: показатели появятся, когда тренер выберет запись справочника.
 * Чистые функции, без БД. Тесты — recipe-drafts.test.ts.
 */
import type { DishRecipe } from "../data/dish-recipes";
import type { Per100 } from "./food-reference-rules";
import { recipeNutrition, type Recipe, type RecipeIngredient } from "./recipe-calc";
import { matchIngredient } from "./ingredient-match";
import { parseIngredientLine, type CatalogItem, type MatchResult, type ParsedIngredient } from "./recipe-text";

/**
 * Порций в черновике: одна, как в каталоге блюд. Это предположение, тренер подтверждает или меняет.
 */
export const DRAFT_SERVINGS = 1;

export type RecipeDraft = {
  recipe: Recipe;
  /** Подсказки по справочнику для каждого ингредиента. Выбор делает тренер. */
  suggestions: Record<string, MatchResult>;
};

/**
 * Превращает разобранную строку в ингредиент движка. Граммы и миллилитры переносятся как есть.
 * Штуки, ч. л., щепотка и строки без количества не переводятся в граммы: количество остаётся пустым,
 * и движок честно сообщит, что его нет.
 */
export function toIngredient(item: ParsedIngredient, id: string, per100: Per100 | null): RecipeIngredient {
  const measurable = item.unit === "g" || item.unit === "ml";
  return {
    id,
    name: item.name,
    state: item.state ?? "unknown",
    unit: item.unit === "ml" ? "ml" : "g",
    amount: measurable ? item.amount : null,
    density: null,
    per100,
  };
}

/** Черновик блюда: ингредиенты пронумерованы внутри блюда, порция — DRAFT_SERVINGS. */
export function buildDraft(dishId: string, name: string, dish: DishRecipe, catalog: CatalogItem[] = []): RecipeDraft {
  const suggestions: Record<string, MatchResult> = {};
  const ingredients: RecipeIngredient[] = [];
  let index = 0;
  for (const line of dish.ingredients) {
    for (const item of parseIngredientLine(line)) {
      index += 1;
      const id = `${dishId}-${index}`;
      ingredients.push(toIngredient(item, id, null));
      suggestions[id] = matchIngredient(item.name, catalog);
    }
  }
  return {
    recipe: {
      id: dishId,
      name,
      status: "draft",
      servings: DRAFT_SERVINGS,
      yieldGrams: null,
      ingredients,
    },
    suggestions,
  };
}

/** Состояние черновика для экрана: сколько ингредиентов ещё без продукта. */
export function draftProgress(draft: RecipeDraft): { total: number; missingProduct: number } {
  const nutrition = recipeNutrition(draft.recipe);
  return {
    total: draft.recipe.ingredients.length,
    missingProduct: nutrition.issues.filter((i) => i.issue === "no-product").length,
  };
}
