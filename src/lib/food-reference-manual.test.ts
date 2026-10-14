import { test } from "node:test";
import assert from "node:assert/strict";
import { checkManualProduct, manualExternalId, searchQuery, STATE_LABEL } from "./food-reference-manual";

const good = {
  name: "Творог 5%",
  sourceNote: "этикетка производителя, 2026",
  state: "raw",
  per100: { kcal: "121", protein: "17", fat: "5", carbs: "3", fiber: "" },
};

test("ручной продукт с полным набором: проверен, клетчатка не указана — null, а не ноль", () => {
  const checked = checkManualProduct(good);
  assert.equal(checked.ok, true);
  if (!checked.ok) return;
  assert.equal(checked.value.per100.fiber, null);
  assert.equal(checked.value.per100.kcal, 121);
  assert.equal(checked.value.quality, "ok");
});

test("источник обязателен: пустой или короче трёх символов — отказ", () => {
  assert.deepEqual(checkManualProduct({ ...good, sourceNote: "" }), { ok: false, reason: "source" });
  assert.deepEqual(checkManualProduct({ ...good, sourceNote: "ок" }), { ok: false, reason: "source" });
});

test("состояние обязательно: без него продукт не вводится, 'unknown' тоже не принимается", () => {
  assert.deepEqual(checkManualProduct({ ...good, state: undefined }), { ok: false, reason: "state" });
  assert.deepEqual(checkManualProduct({ ...good, state: "unknown" }), { ok: false, reason: "state" });
  assert.deepEqual(checkManualProduct({ ...good, state: "baked" }), { ok: false, reason: "state" });
});

test("неполный набор КБЖУ отклоняется: отсутствующее значение не считается нулём", () => {
  const withoutFat = { ...good, per100: { ...good.per100, fat: "" } };
  assert.deepEqual(checkManualProduct(withoutFat), { ok: false, reason: "incomplete" });
});

test("значения вне диапазона и нечисловые — отказ", () => {
  assert.deepEqual(checkManualProduct({ ...good, per100: { ...good.per100, kcal: "1200" } }), { ok: false, reason: "value" });
  assert.deepEqual(checkManualProduct({ ...good, per100: { ...good.per100, protein: "-1" } }), { ok: false, reason: "value" });
  assert.deepEqual(checkManualProduct({ ...good, per100: { ...good.per100, carbs: "много" } }), { ok: false, reason: "value" });
});

test("сумма макросов больше 105 г на 100 г — отказ", () => {
  const heavy = { ...good, per100: { kcal: "500", protein: "60", fat: "40", carbs: "10", fiber: "" } };
  assert.deepEqual(checkManualProduct(heavy), { ok: false, reason: "macros" });
});

test("калории не сходятся с макросами: запись сохраняется с отметкой mismatch", () => {
  const off = { ...good, per100: { kcal: "400", protein: "17", fat: "5", carbs: "3", fiber: "" } };
  const checked = checkManualProduct(off);
  assert.equal(checked.ok, true);
  if (!checked.ok) return;
  assert.equal(checked.value.quality, "mismatch");
});

test("идентификатор ручной записи: префикс m- и ровно 16 hex-символов", () => {
  assert.equal(manualExternalId("0123456789abcdef"), "m-0123456789abcdef");
  assert.throws(() => manualExternalId("xyz"));
  assert.throws(() => manualExternalId("0123456789ABCDEF"));
});

test("строка поиска: символы подстановки SQL убираются, короткая или длинная отбрасывается", () => {
  assert.equal(searchQuery("  Творог%_ 5 "), "творог 5");
  assert.equal(searchQuery("a"), null);
  assert.equal(searchQuery("x".repeat(61)), null);
  assert.equal(searchQuery(42), null);
});

test("подписи состояний — по-русски, для каждого состояния есть подпись", () => {
  assert.equal(STATE_LABEL.raw, "сырой");
  assert.equal(STATE_LABEL.unknown, "состояние не указано");
});
