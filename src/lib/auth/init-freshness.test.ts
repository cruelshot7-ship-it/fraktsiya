import assert from "node:assert/strict";
import test from "node:test";
import { INIT_DATA_MAX_AGE_SEC, isFreshAuthDate } from "./init-freshness.ts";

const NOW = 1_800_000_000;

test("окно initData — 24 часа", () => {
  assert.equal(INIT_DATA_MAX_AGE_SEC, 86400);
});

test("подпись не старше 24 часов принимается", () => {
  assert.equal(isFreshAuthDate(NOW - 3600, NOW), true);
  assert.equal(isFreshAuthDate(NOW - 86400, NOW), true, "ровно сутки ещё в окне");
});

test("подпись старше 24 часов отклоняется, в том числе те, что были в окне 48 часов", () => {
  assert.equal(isFreshAuthDate(NOW - 86401, NOW), false);
  assert.equal(isFreshAuthDate(NOW - 86400 * 2, NOW), false);
});

test("пустая или некорректная дата отклоняется", () => {
  assert.equal(isFreshAuthDate(0, NOW), false);
  assert.equal(isFreshAuthDate(Number.NaN, NOW), false);
});
