import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGtin, parseScanText } from "./barcode-parse.ts";

test("a plain code, with or without spaces", () => {
  assert.equal(parseScanText("4600690101081"), "4600690101081");
  assert.equal(parseScanText(" 4600 6901 01081 "), "4600690101081");
  assert.equal(parseScanText("46006901010"), "", "11 digits is no barcode");
  assert.equal(parseScanText("046006901010"), "0046006901010", "12 digits get a leading zero");
});

test("a 14-digit GTIN that starts with 01 is a plain code, not a GS1 element string", () => {
  assert.equal(parseScanText("01234567890123"), "1234567890123");
});

test("GS1 element strings from a QR or a GS1-128 label", () => {
  assert.equal(parseScanText("(01)04600690101081(21)A1B2"), "4600690101081");
  assert.equal(parseScanText("010460069010108121A1B2"), "4600690101081");
  assert.equal(parseScanText("]C10104600690101081\x1d21A1B2"), "4600690101081");
  assert.equal(parseScanText("]d20104600690101081"), "4600690101081");
});

test("GS1 digital links and Open Food Facts links", () => {
  assert.equal(parseScanText("https://id.gs1.org/01/04600690101081/21/555"), "4600690101081");
  assert.equal(parseScanText("https://world.openfoodfacts.org/product/4600690101081/творог"), "4600690101081");
  assert.equal(parseScanText("https://example.by/?ean=4600690101081"), "4600690101081");
});

test("a shop link without a code gives nothing, not the digits of its path", () => {
  assert.equal(parseScanText("https://example.by/?a=1234&b=5678901234"), "");
  assert.equal(parseScanText("https://example.by/item/12345"), "");
});

test("free text with the code inside still works", () => {
  assert.equal(parseScanText("EAN 4600 6901 01081"), "4600690101081");
  assert.equal(parseScanText("Творог 5%"), "");
});

test("normalizeGtin pads 12 digits to 13 and strips the zero of a 14-digit code", () => {
  assert.equal(normalizeGtin("046006901010"), "0046006901010");
  assert.equal(normalizeGtin("04600690101081"), "4600690101081");
});
