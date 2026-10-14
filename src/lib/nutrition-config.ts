/**
 * Настройки расчёта КБЖУ. Все коэффициенты и границы живут здесь, а не в компонентах.
 * Значения по умолчанию — стартовые. Тренер подтверждает их для каждого клиента
 * (см. NUTRITION_PLAN.md, N1.1). Изменение значений требует теста на расчёт.
 */

export const ACTIVITY_FACTORS = {
  sedentary: { label: "Сидячая работа, без тренировок", factor: 1.2 },
  light: { label: "Лёгкая активность, 1–3 тренировки в неделю", factor: 1.375 },
  moderate: { label: "Средняя активность, 3–5 тренировок в неделю", factor: 1.55 },
  high: { label: "Высокая активность, 6–7 тренировок в неделю", factor: 1.725 },
  very_high: { label: "Очень высокая: физическая работа и тренировки", factor: 1.9 },
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

/** Поправка к оценке суточного расхода. Отрицательная — снижение веса, положительная — набор. */
export const GOAL_ADJUSTMENT = {
  lose: -0.1,
  maintain: 0,
  gain: 0.1,
} as const;

export type Goal = keyof typeof GOAL_ADJUSTMENT;

/** Минимальная суточная калорийность: ниже неё расчёт не опускается, даже при снижении веса. */
export const KCAL_FLOOR = { male: 1500, female: 1200 } as const;

/** Стартовые нормы белка и жира на килограмм массы тела. Углеводы — остаток калорий. */
export const MACRO_DEFAULTS = {
  proteinPerKg: 1.8,
  fatPerKg: 0.9,
} as const;

/** Пределы для формулы Миффлина — Сан Жеора. Вне них автоматический расчёт не применяется. */
export const LIMITS = {
  age: { min: 18, max: 75 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
} as const;

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;
