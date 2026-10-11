import assert from "node:assert/strict";
import test from "node:test";
import { checkFoodProduct } from "./food-catalog-rules.ts";

const good = {
  barcode: "4607001234562",
  name: "  Творог 5%  ",
  brand: "Бабушкина крынка",
  per100: { calories: 121.04, protein: 16.5, fat: 5, carbs: 3 },
  quantity: "200 г",
  servingGrams: 200.4,
};

test("a real barcode with sane macros is accepted and tidied", () => {
  const res = checkFoodProduct(good);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.value.name, "Творог 5%");
  assert.equal(res.value.per100.calories, 121);
  assert.equal(res.value.per100.protein, 16.5);
  assert.equal(res.value.servingGrams, 200);
});

test("manual entries without a real code are not shared", () => {
  assert.deepEqual(checkFoodProduct({ ...good, barcode: "manual_1719000000000" }), { ok: false, reason: "barcode" });
  assert.deepEqual(checkFoodProduct({ ...good, barcode: "123" }), { ok: false, reason: "barcode" });
});

test("nonsense nutrition is rejected", () => {
  assert.equal(checkFoodProduct({ ...good, per100: { ...good.per100, calories: 5000 } }).ok, false);
  assert.equal(checkFoodProduct({ ...good, per100: { ...good.per100, protein: -1 } }).ok, false);
  assert.deepEqual(checkFoodProduct({ ...good, per100: { calories: 500, protein: 60, fat: 40, carbs: 30 } }), { ok: false, reason: "macros" });
});

test("name and serving limits", () => {
  assert.equal(checkFoodProduct({ ...good, name: "а" }).ok, false);
  assert.equal(checkFoodProduct({ ...good, servingGrams: 0 }).ok, false);
  assert.equal(checkFoodProduct({ ...good, servingGrams: 5000 }).ok, false);
  assert.equal(checkFoodProduct(null).ok, false);
});

test("UPC-A сохраняется в том же виде, что и поиск: 13 знаков", () => {
  const res = checkFoodProduct({ ...good, barcode: "036000291452" });
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(res.value.barcode, "0036000291452");
});

test("код с неверной контрольной цифрой не принимается", () => {
  assert.deepEqual(checkFoodProduct({ ...good, barcode: "4600690101081" }), { ok: false, reason: "barcode" });
});
