import { test } from "node:test";
import assert from "node:assert/strict";
import {
  atwaterQuality,
  decideUpsert,
  dedupeByExternalId,
  detectState,
  parseReference,
  type ReferenceRecord,
} from "./food-reference-rules";

const chicken = {
  externalId: "171477",
  name: "Chicken breast, raw",
  dataType: "SR Legacy",
  description: "Chicken, broilers or fryers, breast, meat only, raw",
  per100: { kcal: "120", protein: "22.5", fat: "2.6", carbs: "0", fiber: "" },
};

test("разбор: строки с числами, пустое значение остаётся null, а не нулём", () => {
  const parsed = parseReference(chicken);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.per100.kcal, 120);
  assert.equal(parsed.value.per100.fiber, null);
  assert.equal(parsed.value.state, "raw");
  assert.equal(parsed.value.quality, "ok");
});

test("запятая как разделитель и пустые макросы: запись неполная, а не отклонённая", () => {
  const parsed = parseReference({ ...chicken, per100: { kcal: "120,5", protein: "", fat: "2", carbs: "1" } });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.per100.kcal, 120.5);
  assert.equal(parsed.value.per100.protein, null);
  assert.equal(parsed.value.quality, "incomplete");
});

test("отклоняются: нет id, нет названия, отрицательные и нечисловые значения, сумма макросов больше 105", () => {
  assert.deepEqual(parseReference({ ...chicken, externalId: "abc" }), { ok: false, reason: "id" });
  assert.deepEqual(parseReference({ ...chicken, name: " " }), { ok: false, reason: "name" });
  assert.deepEqual(parseReference({ ...chicken, per100: { ...chicken.per100, fat: "-1" } }), { ok: false, reason: "value:fat" });
  assert.deepEqual(parseReference({ ...chicken, per100: { ...chicken.per100, kcal: "many" } }), { ok: false, reason: "value:kcal" });
  assert.deepEqual(
    parseReference({ ...chicken, per100: { kcal: 300, protein: 60, fat: 50, carbs: 10, fiber: 0 } }),
    { ok: false, reason: "macros" },
  );
});

test("калории не сходятся с макросами: запись помечается, но не отклоняется", () => {
  // 22.5·4 + 2.6·9 = 113.4 ккал, в записи 300 — явное расхождение
  assert.equal(atwaterQuality({ kcal: 300, protein: 22.5, fat: 2.6, carbs: 0, fiber: null }), "mismatch");
  assert.equal(atwaterQuality({ kcal: 115, protein: 22.5, fat: 2.6, carbs: 0, fiber: null }), "ok");
});

test("состояние продукта: сырой, варёный, жареный и сухой различаются", () => {
  assert.equal(detectState("Rice, white, cooked"), "cooked");
  assert.equal(detectState("Oats, dry"), "dry");
  assert.equal(detectState("Potatoes, fried"), "fried");
  assert.equal(detectState("Chicken breast, raw"), "raw");
  assert.equal(detectState("Apple, pink lady"), "unknown");
});

test("повтор в одном файле не импортируется второй раз", () => {
  const { unique, duplicates } = dedupeByExternalId([{ externalId: "1" }, { externalId: "2" }, { externalId: "1" }]);
  assert.equal(unique.length, 2);
  assert.equal(duplicates, 1);
});

const record = (overrides: Partial<ReferenceRecord> = {}): ReferenceRecord => {
  const parsed = parseReference(chicken);
  if (!parsed.ok) throw new Error("fixture");
  return { ...parsed.value, ...overrides };
};

test("повторный импорт: нет записи — вставка, то же самое — без изменений", () => {
  const incoming = record();
  assert.equal(decideUpsert(null, incoming), "insert");
  const existing = { name: incoming.name, state: incoming.state, status: "imported" as const, per100: incoming.per100 };
  assert.equal(decideUpsert(existing, incoming), "unchanged");
});

test("проверенная запись не заменяется импортом: конфликт, а не перезапись", () => {
  const incoming = record({ per100: { kcal: 130, protein: 22, fat: 3, carbs: 0, fiber: null } });
  const verified = { name: incoming.name, state: incoming.state, status: "verified" as const, per100: record().per100 };
  assert.equal(decideUpsert(verified, incoming), "conflict");
});

test("непроверенная запись с другими значениями обновляется", () => {
  const incoming = record({ per100: { kcal: 130, protein: 22, fat: 3, carbs: 0, fiber: null } });
  const imported = { name: incoming.name, state: incoming.state, status: "imported" as const, per100: record().per100 };
  assert.equal(decideUpsert(imported, incoming), "update");
});
