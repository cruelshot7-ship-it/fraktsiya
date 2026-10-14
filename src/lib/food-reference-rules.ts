/**
 * Правила справочника продуктов: разбор записи источника, состояние продукта, решение при повторном импорте.
 * Чистые функции, без БД и сети. Тесты — food-reference-rules.test.ts.
 *
 * Принципы из задания: отсутствующее значение — не ноль; проверенные записи не заменяются;
 * расхождения между значениями не объединяются молча.
 */

export type FoodState = "raw" | "cooked" | "fried" | "dry" | "unknown";
export type Quality = "ok" | "incomplete" | "mismatch";

export type Per100 = {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
};

export type ReferenceRecord = {
  externalId: string;
  name: string;
  dataType: string | null;
  state: FoodState;
  per100: Per100;
  quality: Quality;
};

export type ParseResult = { ok: true; value: ReferenceRecord } | { ok: false; reason: string };

/** Допуск расхождения калорий с суммой по макросам (Атуотер): больше — проверить, не отклонять. */
export const ATWATER_TOLERANCE = 0.1;
/** Калории ниже этой величины сравнивать по проценту бессмысленно. */
const ATWATER_MIN_KCAL = 5;

const MAX: Record<keyof Per100, number> = { kcal: 900, protein: 100, fat: 100, carbs: 100, fiber: 100 };

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Пустая строка, null и undefined — отсутствующее значение. Число или строка с числом — значение. */
function readNumber(raw: unknown, max: number): { ok: true; value: number | null } | { ok: false } {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === "string") {
    const text = raw.trim().replace(",", ".");
    if (text === "") return { ok: true, value: null };
    const n = Number(text);
    if (!Number.isFinite(n)) return { ok: false };
    raw = n;
  }
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > max) return { ok: false };
  return { ok: true, value: round1(raw) };
}

/** Состояние продукта по описанию источника: «Chicken breast, raw», «Rice, white, cooked». */
export function detectState(description: string): FoodState {
  const d = description.toLowerCase();
  if (/\bfried\b/.test(d)) return "fried";
  if (/\b(cooked|boiled|baked|roasted|steamed|grilled|stewed)\b/.test(d)) return "cooked";
  if (/\braw\b/.test(d)) return "raw";
  if (/\b(dry|dried)\b/.test(d)) return "dry";
  return "unknown";
}

/** Сравнение калорий и макросов. Возвращает «mismatch», если калории не сходятся с макросами. */
export function atwaterQuality(p: Per100): Quality {
  if (p.kcal === null || p.protein === null || p.fat === null || p.carbs === null) return "incomplete";
  const computed = 4 * p.protein + 4 * p.carbs + 9 * p.fat;
  if (p.kcal < ATWATER_MIN_KCAL && computed < ATWATER_MIN_KCAL) return "ok";
  const base = Math.max(p.kcal, computed);
  return Math.abs(p.kcal - computed) / base > ATWATER_TOLERANCE ? "mismatch" : "ok";
}

/** Разбор одной записи источника. Ошибка возвращает причину, запись пропускается и попадает в отчёт. */
export function parseReference(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "shape" };
  const r = raw as Record<string, unknown>;

  const externalId = String(r.externalId ?? "").trim();
  if (!/^\d{1,20}$/.test(externalId)) return { ok: false, reason: "id" };

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < 2 || name.length > 200) return { ok: false, reason: "name" };

  const values = (r.per100 ?? {}) as Record<string, unknown>;
  const per100 = {} as Per100;
  for (const key of Object.keys(MAX) as (keyof Per100)[]) {
    const read = readNumber(values[key], MAX[key]);
    if (!read.ok) return { ok: false, reason: `value:${key}` };
    per100[key] = read.value;
  }

  // сумма макросов не больше самого продукта (граммы на 100 г)
  const macroSum = (per100.protein ?? 0) + (per100.fat ?? 0) + (per100.carbs ?? 0);
  if (macroSum > 105) return { ok: false, reason: "macros" };

  const description = typeof r.description === "string" ? r.description : name;
  const dataType = typeof r.dataType === "string" && r.dataType.trim() ? r.dataType.trim().slice(0, 40) : null;

  return {
    ok: true,
    value: {
      externalId,
      name: name.slice(0, 200),
      dataType,
      state: detectState(description),
      per100,
      quality: atwaterQuality(per100),
    },
  };
}

/** Одна запись на внешний идентификатор в пределах файла: повтор не импортируется второй раз. */
export function dedupeByExternalId<T extends { externalId: string }>(records: T[]): { unique: T[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  let duplicates = 0;
  for (const record of records) {
    if (seen.has(record.externalId)) {
      duplicates += 1;
      continue;
    }
    seen.add(record.externalId);
    unique.push(record);
  }
  return { unique, duplicates };
}

export type Existing = {
  name: string;
  state: FoodState;
  status: "imported" | "verified";
  per100: Per100;
};

export type UpsertDecision = "insert" | "unchanged" | "update" | "conflict";

/**
 * Что делать с записью при импорте.
 * - нет такой записи → вставить;
 * - то же самое → ничего не менять;
 * - запись проверена тренером и отличается → конфликт: в очередь на ручное решение, сама запись не меняется;
 * - непроверенная запись отличается → обновить (это данные импорта, их можно освежить).
 */
export function decideUpsert(existing: Existing | null, incoming: ReferenceRecord): UpsertDecision {
  if (!existing) return "insert";
  const same =
    existing.name === incoming.name &&
    existing.state === incoming.state &&
    (Object.keys(MAX) as (keyof Per100)[]).every((key) => existing.per100[key] === incoming.per100[key]);
  if (same) return "unchanged";
  if (existing.status === "verified") return "conflict";
  return "update";
}
