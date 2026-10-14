/**
 * Импорт USDA FoodData Central: чистая часть (без БД и файлов).
 * Файлы читает scripts/import-usda.ts, правила разбора и решений — food-reference-rules.ts.
 * Тесты — usda-import.test.ts.
 */
import { decideUpsert, type Existing, parseReference, type Per100, type ReferenceRecord } from "./food-reference-rules";

/** Берём только обобщённые данные: они описывают состояние продукта. Брендовые и опросные — позже. */
export const USDA_DATA_TYPES = ["Foundation", "SR Legacy"] as const;

/**
 * Номера нутриентов в USDA FoodData Central. Перед импортом проверяем по nutrient.csv:
 * если номер или название/единица не совпали, импорт останавливается, а не пишет неверные значения.
 */
export const USDA_NUTRIENTS: Record<keyof Per100, { id: number; name: string; unit: string }> = {
  kcal: { id: 1008, name: "Energy", unit: "KCAL" },
  protein: { id: 1003, name: "Protein", unit: "G" },
  fat: { id: 1004, name: "Total lipid (fat)", unit: "G" },
  carbs: { id: 1005, name: "Carbohydrate, by difference", unit: "G" },
  fiber: { id: 1079, name: "Fiber, total dietary", unit: "G" },
};

/** Разбор одной строки CSV: кавычки, экранирование двойными кавычками, запятые внутри кавычек. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export type NutrientRow = { id: number; name: string; unit: string };

/** Все нужные нутриенты есть, с правильными названиями и единицами. Иначе — список того, что не сошлось. */
export function checkNutrientTable(rows: NutrientRow[]): { ok: true } | { ok: false; mismatched: string[] } {
  const mismatched: string[] = [];
  for (const [key, expected] of Object.entries(USDA_NUTRIENTS)) {
    const row = rows.find((r) => r.id === expected.id);
    if (!row || row.name !== expected.name || row.unit !== expected.unit) {
      mismatched.push(`${key}:${expected.id}`);
    }
  }
  return mismatched.length ? { ok: false, mismatched } : { ok: true };
}

export type UsdaFood = { fdcId: string; dataType: string; description: string };

/** Сборка входа для parseReference из строки food.csv и значений нутриентов. */
export function toRawReference(food: UsdaFood, values: Partial<Record<keyof Per100, string>>): unknown {
  return {
    externalId: food.fdcId,
    name: food.description.slice(0, 200),
    dataType: food.dataType,
    description: food.description,
    per100: values,
  };
}

/** Разбор записи USDA целиком: сначала сборка входа, затем общие правила справочника. */
export function parseUsdaFood(food: UsdaFood, values: Partial<Record<keyof Per100, string>>) {
  return parseReference(toRawReference(food, values));
}

export type PlannedBatch = {
  inserts: ReferenceRecord[];
  updates: ReferenceRecord[];
  unchanged: number;
  conflicts: string[];
};

/** Что делать с батчем записей, при известных существующих строках. Конфликты в базу не пишутся. */
export function planBatch(records: ReferenceRecord[], existing: Map<string, Existing>): PlannedBatch {
  const plan: PlannedBatch = { inserts: [], updates: [], unchanged: 0, conflicts: [] };
  for (const record of records) {
    const decision = decideUpsert(existing.get(record.externalId) ?? null, record);
    if (decision === "insert") plan.inserts.push(record);
    else if (decision === "update") plan.updates.push(record);
    else if (decision === "unchanged") plan.unchanged += 1;
    else plan.conflicts.push(record.externalId);
  }
  return plan;
}

export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error("chunk size must be >= 1");
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
