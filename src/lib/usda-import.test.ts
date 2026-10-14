import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkNutrientTable,
  chunk,
  parseUsdaFood,
  planBatch,
  splitCsvLine,
  toRawReference,
  USDA_NUTRIENTS,
  type NutrientRow,
} from "./usda-import";
import type { Existing, ReferenceRecord } from "./food-reference-rules";

const food = { fdcId: "171477", dataType: "SR Legacy", description: "Chicken, broilers or fryers, breast, meat only, raw" };

test("CSV: запятые и кавычки внутри поля, экранирование двойными кавычками", () => {
  assert.deepEqual(splitCsvLine('1,"Chicken, breast, raw",SR Legacy'), ["1", "Chicken, breast, raw", "SR Legacy"]);
  assert.deepEqual(splitCsvLine('2,"Say ""hi""",x'), ["2", 'Say "hi"', "x"]);
  assert.deepEqual(splitCsvLine("3,,"), ["3", "", ""]);
});

test("проверка таблицы нутриентов: все номера на месте — ok", () => {
  const rows: NutrientRow[] = Object.values(USDA_NUTRIENTS).map((n) => ({ ...n }));
  assert.deepEqual(checkNutrientTable(rows), { ok: true });
});

test("проверка таблицы нутриентов: другая единица или отсутствующий номер — импорт останавливается", () => {
  const rows: NutrientRow[] = Object.values(USDA_NUTRIENTS).map((n) => ({ ...n }));
  rows[0] = { ...rows[0], unit: "kJ" };
  rows.splice(2, 1);
  const result = checkNutrientTable(rows);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.mismatched.sort(), ["fat:1004", "kcal:1008"].sort());
});

test("сборка записи: описание обрезается до 200 символов, отсутствующие значения — null", () => {
  const long = { ...food, description: "A".repeat(250) };
  const raw = toRawReference(long, { kcal: "120", protein: "22" }) as { name: string; per100: Record<string, string> };
  assert.equal(raw.name.length, 200);
  assert.equal(raw.per100.kcal, "120");
});

test("разбор записи USDA: состояние по описанию, нет жира — неполная запись, а не ноль", () => {
  const parsed = parseUsdaFood(food, { kcal: "120", protein: "22.5", carbs: "0" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.state, "raw");
  assert.equal(parsed.value.per100.fat, null);
  assert.equal(parsed.value.quality, "incomplete");
});

test("разбор: записи без калорий и макросов не превращаются в нулевую запись", () => {
  const parsed = parseUsdaFood(food, {});
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.per100.kcal, null);
  assert.equal(parsed.value.quality, "incomplete");
});

function rec(externalId: string, kcal: number | null): ReferenceRecord {
  return {
    externalId,
    name: `food ${externalId}`,
    dataType: "SR Legacy",
    state: "raw",
    per100: { kcal, protein: 20, fat: 1, carbs: 0, fiber: null },
    quality: "ok",
  };
}

test("план батча: новые — вставка, совпавшие — без изменений, отличающиеся импортные — обновление", () => {
  const existing = new Map<string, Existing>([
    ["1", { name: "food 1", state: "raw", status: "imported", per100: { kcal: 120, protein: 20, fat: 1, carbs: 0, fiber: null } }],
    ["2", { name: "food 2", state: "raw", status: "imported", per100: { kcal: 999, protein: 20, fat: 1, carbs: 0, fiber: null } }],
  ]);
  const plan = planBatch([rec("1", 120), rec("2", 100), rec("3", 50)], existing);
  assert.deepEqual(plan.inserts.map((r) => r.externalId), ["3"]);
  assert.deepEqual(plan.updates.map((r) => r.externalId), ["2"]);
  assert.equal(plan.unchanged, 1);
  assert.deepEqual(plan.conflicts, []);
});

test("план батча: проверенная тренером запись с другими значениями — конфликт, не обновление", () => {
  const existing = new Map<string, Existing>([
    ["7", { name: "food 7", state: "raw", status: "verified", per100: { kcal: 300, protein: 20, fat: 1, carbs: 0, fiber: null } }],
  ]);
  const plan = planBatch([rec("7", 100)], existing);
  assert.deepEqual(plan.updates, []);
  assert.deepEqual(plan.conflicts, ["7"]);
});

test("батчи: размер и остаток, пустой вход, неверный размер", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([], 3), []);
  assert.throws(() => chunk([1], 0));
});
