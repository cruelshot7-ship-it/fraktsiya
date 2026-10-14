/**
 * Ручной ввод продукта тренером: проверка данных, поиск по справочнику. Чистые функции, без БД.
 * Тесты — food-reference-manual.test.ts. Правила состояния и сверки калорий — food-reference-rules.ts.
 *
 * Для расчёта продукт обязан иметь состояние (сырой, варёный, жареный, сухой) и все четыре значения КБЖУ.
 * Отсутствующее значение не становится нулём: такой продукт не вводится, пока тренер его не заполнит.
 */
import { atwaterQuality, type FoodState, type Per100, type Quality } from "./food-reference-rules";

export const MANUAL_STATES: FoodState[] = ["raw", "cooked", "fried", "dry"];

export type ManualProduct = {
  name: string;
  sourceNote: string;
  state: FoodState;
  per100: Per100;
  quality: Quality;
};

export type ManualCheck = { ok: true; value: ManualProduct } | { ok: false; reason: string };

const round1 = (value: number) => Math.round(value * 10) / 10;

const RANGE: Record<"kcal" | "protein" | "fat" | "carbs", number> = { kcal: 900, protein: 100, fat: 100, carbs: 100 };

/** Число в пределах или null. Пустая строка — null (значение не задано). */
function number(raw: unknown, max: number): number | null | "bad" {
  if (raw === null || raw === undefined) return null;
  const text = typeof raw === "string" ? raw.trim().replace(",", ".") : raw;
  if (text === "") return null;
  const n = typeof text === "number" ? text : Number(text);
  if (!Number.isFinite(n) || n < 0 || n > max) return "bad";
  return round1(n);
}

export function checkManualProduct(raw: unknown): ManualCheck {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "shape" };
  const r = raw as Record<string, unknown>;

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < 2 || name.length > 120) return { ok: false, reason: "name" };

  const sourceNote = typeof r.sourceNote === "string" ? r.sourceNote.trim() : "";
  if (sourceNote.length < 3 || sourceNote.length > 200) return { ok: false, reason: "source" };

  const state = r.state;
  if (typeof state !== "string" || !(MANUAL_STATES as string[]).includes(state)) return { ok: false, reason: "state" };

  const values = (r.per100 ?? {}) as Record<string, unknown>;
  const kcal = number(values.kcal, RANGE.kcal);
  const protein = number(values.protein, RANGE.protein);
  const fat = number(values.fat, RANGE.fat);
  const carbs = number(values.carbs, RANGE.carbs);
  const fiber = number(values.fiber, RANGE.carbs);
  // для ручного ввода обязательны калории и три макроса; клетчатка может быть не указана
  if (kcal === "bad" || protein === "bad" || fat === "bad" || carbs === "bad" || fiber === "bad") {
    return { ok: false, reason: "value" };
  }
  if (kcal === null || protein === null || fat === null || carbs === null) return { ok: false, reason: "incomplete" };

  // граммы на 100 г: три макроса не могут занимать больше самого продукта
  if (protein + fat + carbs > 105) return { ok: false, reason: "macros" };

  const per100: Per100 = { kcal, protein, fat, carbs, fiber };
  return {
    ok: true,
    value: { name, sourceNote, state: state as FoodState, per100, quality: atwaterQuality(per100) },
  };
}

/** Идентификатор ручной записи: префикс и случайная часть, передаётся снаружи (crypto на сервере). */
export function manualExternalId(randomHex: string): string {
  if (!/^[0-9a-f]{16}$/.test(randomHex)) throw new Error("manual id needs 16 hex chars");
  return `m-${randomHex}`;
}

/** Строка поиска: без подстановочных символов SQL, от 2 до 60 символов. */
export function searchQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/[%_\\]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (text.length < 2 || text.length > 60) return null;
  return text;
}

export const STATE_LABEL: Record<FoodState, string> = {
  raw: "сырой",
  cooked: "варёный",
  fried: "жареный",
  dry: "сухой",
  unknown: "состояние не указано",
};
