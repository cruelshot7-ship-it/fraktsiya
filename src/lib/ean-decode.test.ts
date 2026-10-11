import assert from "node:assert/strict";
import test from "node:test";
import { decodeEan13Row, ean13Modules } from "./ean-decode.ts";

/** Строка пикселей: тихая зона, модули по `px` пикселей с небольшим разбросом, шум по яркости. */
function rowOf(bits: string, px: number, noise = 0, seed = 1, jitter = 0.3): number[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const out: number[] = [];
  const quiet = 20;
  for (let i = 0; i < quiet; i++) out.push(230);
  for (const b of bits) {
    const width = Math.max(1, Math.round(px + (rnd() - 0.5) * (px * jitter)));
    const base = b === "1" ? 35 : 215;
    for (let i = 0; i < width; i++) out.push(Math.min(255, Math.max(0, base + (rnd() - 0.5) * noise)));
  }
  for (let i = 0; i < quiet; i++) out.push(230);
  return out;
}

test("EAN-13 читается из строки при разной ширине модуля и шуме", () => {
  for (const code of ["4813494088838", "3017620422003", "5449000000996", "0036000291452"]) {
    assert.equal(decodeEan13Row(rowOf(ean13Modules(code), 3, 0, 1, 0.15)), code, `plain ${code}`);
    assert.equal(decodeEan13Row(rowOf(ean13Modules(code), 4, 30, 7, 0.15)), code, `noisy ${code}`);
    assert.equal(decodeEan13Row(rowOf(ean13Modules(code), 5, 20, 3, 0.15)), code, `wide ${code}`);
  }
});

test("код с неверной контрольной цифрой не читается", () => {
  const bad = "4600690101081"; // контрольная цифра не сходится
  assert.equal(decodeEan13Row(rowOf(ean13Modules(bad), 3)), null);
});

test("пустая или плоская строка не даёт кода", () => {
  assert.equal(decodeEan13Row(new Array(300).fill(200)), null);
  assert.equal(decodeEan13Row([1, 2, 3]), null);
});
