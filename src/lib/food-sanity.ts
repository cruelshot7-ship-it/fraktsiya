/**
 * Проверка КБЖУ на разумность. Чистая функция: общая для каталога студии и данных Open Food Facts.
 */
export type Per100Values = { calories: number; protein: number; fat: number; carbs: number };

/** Граммы на 100 г продукта: макросы не могут в сумме превышать сам продукт. */
export function macrosSane(p: Per100Values): boolean {
  const values = [p.calories, p.protein, p.fat, p.carbs];
  if (values.some((v) => !Number.isFinite(v) || v < 0)) return false;
  return p.calories <= 900 && p.protein <= 100 && p.fat <= 100 && p.carbs <= 100 && p.protein + p.fat + p.carbs <= 105;
}

/** Энергия по макросам: белок и углеводы по 4 ккал, жир по 9 ккал. Для записей без ккал. */
export function kcalFromMacros(p: Omit<Per100Values, "calories">): number {
  return Math.round(4 * p.protein + 4 * p.carbs + 9 * p.fat);
}
