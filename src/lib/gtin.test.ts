import assert from "node:assert/strict";
import test from "node:test";
import { isValidGtin, normalizeGtin } from "./gtin.ts";

test("контрольная цифра EAN-13 и EAN-8", () => {
  assert.equal(isValidGtin("3017620422003"), true); // Nutella
  assert.equal(isValidGtin("5449000000996"), true); // Coca-Cola
  assert.equal(isValidGtin("96385074"), true); // EAN-8 из примера GS1
  assert.equal(isValidGtin("4600690101081"), false); // контрольная цифра не сходится
  assert.equal(isValidGtin("12345678"), false);
  assert.equal(isValidGtin("1234567890123456"), false); // длина не 8 и не 13
});

test("UPC-A дополняется до 13 знаков перед проверкой", () => {
  const upc = normalizeGtin("036000291452");
  assert.equal(upc, "0036000291452");
  assert.equal(isValidGtin(upc), true);
  assert.equal(normalizeGtin("00360002914529"), "0360002914529"); // 14 знаков с ведущим нулём
});
