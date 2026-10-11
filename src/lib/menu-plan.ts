/**
 * Меню дня из нормы КБЖУ. Чистая логика: без БД и UI.
 * Тренер подтверждает блюда из базы, клиенту показываются варианты.
 * Детерминированно: одинаковые входные данные дают одинаковое меню.
 */

export type Macro = { calories: number; protein: number; fat: number; carbs: number };

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";

/** Блюдо из базы. Совместимо с Meal из data/studio.ts (структурно, без импорта). */
export type DishLike = Macro & { id: string; name: string; kind?: MealKind };

export type SlotSpec = { id: string; label: string; share: number; kind: MealKind };

/** Доли нормы по приёмам. Сумма долей в каждом шаблоне равна 1. */
export const MEAL_PATTERNS: Record<3 | 4 | 5, SlotSpec[]> = {
  3: [
    { id: "breakfast", label: "Завтрак", share: 0.3, kind: "breakfast" },
    { id: "lunch", label: "Обед", share: 0.4, kind: "lunch" },
    { id: "dinner", label: "Ужин", share: 0.3, kind: "dinner" },
  ],
  4: [
    { id: "breakfast", label: "Завтрак", share: 0.25, kind: "breakfast" },
    { id: "lunch", label: "Обед", share: 0.35, kind: "lunch" },
    { id: "snack", label: "Перекус", share: 0.1, kind: "snack" },
    { id: "dinner", label: "Ужин", share: 0.3, kind: "dinner" },
  ],
  5: [
    { id: "breakfast", label: "Завтрак", share: 0.2, kind: "breakfast" },
    { id: "snack1", label: "Перекус", share: 0.1, kind: "snack" },
    { id: "lunch", label: "Обед", share: 0.3, kind: "lunch" },
    { id: "snack2", label: "Перекус", share: 0.1, kind: "snack" },
    { id: "dinner", label: "Ужин", share: 0.3, kind: "dinner" },
  ],
};

export const OPTIONS_PER_SLOT = 3;
/** Допуск по калориям, в пределах которого блюдо считается попадающим в приём. */
export const KCAL_TOLERANCE = 0.1;

export type SlotTarget = SlotSpec & { target: Macro };

export function slotTargets(target: Macro, spec: SlotSpec[]): SlotTarget[] {
  return spec.map((slot) => ({
    ...slot,
    target: {
      calories: Math.round(target.calories * slot.share),
      protein: Math.round(target.protein * slot.share),
      fat: Math.round(target.fat * slot.share),
      carbs: Math.round(target.carbs * slot.share),
    },
  }));
}

/** Чем меньше, тем лучше. Калории весят больше белка; несовпадение приёма штрафуется. */
export function fitScore(dish: DishLike, slot: SlotTarget): number {
  const dk = Math.abs(dish.calories - slot.target.calories) / Math.max(slot.target.calories, 1);
  const dp = Math.abs(dish.protein - slot.target.protein) / Math.max(slot.target.protein, 1);
  let score = 0.6 * dk + 0.4 * dp;
  if (dish.kind && dish.kind !== slot.kind) score += 0.6;
  return score;
}

export type MenuOption = { dish: DishLike; score: number; within: boolean };
export type MenuSlot = SlotTarget & { options: MenuOption[] };

export type DayMenu =
  | { ok: true; count: 3 | 4 | 5; slots: MenuSlot[] }
  | { ok: false; reason: "count" | "target" | "no-dishes" };

/**
 * Варианты на каждый приём: сначала блюда, которых ещё нет в меню дня, потом повторы.
 * Внутри приёма блюда не повторяются. Повторы появляются только если база меньше нужного.
 */
export function buildDayMenu(target: Macro, count: number, dishes: DishLike[]): DayMenu {
  if (count !== 3 && count !== 4 && count !== 5) return { ok: false, reason: "count" };
  if (!(target.calories >= 800 && target.calories <= 6000)) return { ok: false, reason: "target" };
  if (dishes.length === 0) return { ok: false, reason: "no-dishes" };

  const spec = MEAL_PATTERNS[count];
  const used = new Set<string>();
  const slots: MenuSlot[] = slotTargets(target, spec).map((slot) => {
    const ranked = dishes
      .map((dish) => ({ dish, score: fitScore(dish, slot) }))
      .sort((a, b) => a.score - b.score || a.dish.id.localeCompare(b.dish.id));
    const fresh = ranked.filter((r) => !used.has(r.dish.id));
    const repeated = ranked.filter((r) => used.has(r.dish.id));
    const picked = [...fresh, ...repeated].slice(0, OPTIONS_PER_SLOT);
    picked.forEach((r) => used.add(r.dish.id));
    return {
      ...slot,
      options: picked.map((r) => ({
        dish: r.dish,
        score: r.score,
        within: Math.abs(r.dish.calories - slot.target.calories) / Math.max(slot.target.calories, 1) <= KCAL_TOLERANCE,
      })),
    };
  });
  return { ok: true, count, slots };
}

/** Сумма выбранных блюд. selection: slotId → dishId. Неизвестные id пропускаются. */
export function dayTotals(selection: Record<string, string>, slots: SlotTarget[], dishes: DishLike[]): Macro {
  const byId = new Map(dishes.map((d) => [d.id, d]));
  const total: Macro = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  for (const slot of slots) {
    const dish = byId.get(selection[slot.id] ?? "");
    if (!dish) continue;
    total.calories += dish.calories;
    total.protein += dish.protein;
    total.fat += dish.fat;
    total.carbs += dish.carbs;
  }
  return total;
}

export type DayStatus = { kcal: "ok" | "low" | "high"; protein: "ok" | "low" };

/** Итог дня против нормы: калории в пределах ±10%, белок не ниже 90% нормы. */
export function dayStatus(totals: Macro, target: Macro): DayStatus {
  const dev = (totals.calories - target.calories) / Math.max(target.calories, 1);
  return {
    kcal: dev > KCAL_TOLERANCE ? "high" : dev < -KCAL_TOLERANCE ? "low" : "ok",
    protein: totals.protein < target.protein * 0.9 ? "low" : "ok",
  };
}
