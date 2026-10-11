/**
 * Декодер EAN-13 (и UPC-A как EAN-13 с ведущим нулём) по строке пикселей.
 * Чистые функции: без камеры и браузера, поэтому покрыты тестами.
 * Нужен там, где нет нативного BarcodeDetector (Safari и iOS WebView).
 */
import { isValidGtin } from "@/lib/gtin";

/** Таблицы EAN-13: L и G — левая половина (чётность), R — правая. 1 = чёрный модуль. */
const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
/** Чётность шести левых цифр (L = 0, G = 1) задаёт первую цифру кода. */
const PARITY = ["000000", "001011", "001101", "001110", "010011", "011001", "011100", "010101", "010110", "011010"];

/** Модули 95 штук → 13 цифр. Строка должна пройти контрольную цифру GTIN. */
export function gtinFromModules(bits: string): string | null {
  if (bits.length !== 95) return null;
  if (bits.slice(0, 3) !== "101" || bits.slice(45, 50) !== "01010" || bits.slice(92) !== "101") return null;
  let parity = "";
  let digits = "";
  for (let d = 0; d < 6; d++) {
    const seg = bits.slice(3 + 7 * d, 10 + 7 * d);
    const li = L.indexOf(seg);
    if (li >= 0) {
      parity += "0";
      digits += String(li);
      continue;
    }
    const gi = G.indexOf(seg);
    if (gi < 0) return null;
    parity += "1";
    digits += String(gi);
  }
  const first = PARITY.indexOf(parity);
  if (first < 0) return null;
  for (let d = 0; d < 6; d++) {
    const ri = R.indexOf(bits.slice(50 + 7 * d, 57 + 7 * d));
    if (ri < 0) return null;
    digits += String(ri);
  }
  const code = String(first) + digits;
  return isValidGtin(code) ? code : null;
}

/** Строка 95 модулей для EAN-13: используется в тестах и как справка по формату. */
export function ean13Modules(code: string): string {
  const d = code.split("").map(Number);
  const par = PARITY[d[0]];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += par[i - 1] === "0" ? L[d[i]] : G[d[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  return bits + "101";
}

/** Серии одинакового цвета → 95 модулей; каждая серия округляется отдельно, ошибки не копятся. */
function runsToBits(lengths: number[], dark: boolean[], j: number, unit: number): string | null {
  let bits = "";
  let total = 0;
  for (let k = 0; k < 59; k++) {
    const count = Math.round(lengths[j + k] / unit);
    if (count < 1) return null;
    total += count;
    bits += (dark[j + k] ? "1" : "0").repeat(count);
  }
  return total === 95 ? bits : null;
}

/** Центры 95 модулей от начала окна: точно, если модули равномерные. */
function sampleBits(gray: ArrayLike<number>, threshold: number, from: number, unit: number): string {
  let bits = "";
  for (let k = 0; k < 95; k++) {
    const x = Math.min(gray.length - 1, Math.floor(from + (k + 0.5) * unit));
    bits += gray[x] < threshold ? "1" : "0";
  }
  return bits;
}

/**
 * Яркости одной строки (0–255) → код EAN-13 или null.
 * Порог — середина между самым тёмным и самым светлым пикселем. Берём серии одинаковых пикселей,
 * переводим их в модули по общей ширине 59 серий (95 модулей) и проверяем таблицы.
 */
export function decodeEan13Row(gray: ArrayLike<number>): string | null {
  const n = gray.length;
  if (n < 95) return null;
  let min = 255;
  let max = 0;
  for (let i = 0; i < n; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  if (max - min < 40) return null;
  const threshold = (min + max) / 2;

  // серии одинакового цвета: позиция начала и длина
  const starts: number[] = [];
  const lengths: number[] = [];
  const dark: boolean[] = [];
  let runDark = gray[0] < threshold;
  let runStart = 0;
  for (let i = 1; i <= n; i++) {
    const isDark = i < n ? gray[i] < threshold : !runDark;
    if (isDark !== runDark) {
      starts.push(runStart);
      lengths.push(i - runStart);
      dark.push(runDark);
      runDark = isDark;
      runStart = i;
    }
  }

  // окно из 59 серий (95 модулей), начинающееся с тёмной полосы
  for (let j = 0; j + 59 <= lengths.length; j++) {
    if (!dark[j]) continue;
    const from = starts[j];
    const to = starts[j + 58] + lengths[j + 58];
    const unit = (to - from) / 95;
    if (unit < 1) continue;
    // два способа перевести серии в модули: по сэмплам центров модулей и по округлённой длине каждой серии
    const byRuns = runsToBits(lengths, dark, j, unit);
    const bySamples = sampleBits(gray, threshold, from, unit);
    const code = (byRuns && gtinFromModules(byRuns)) || gtinFromModules(bySamples);
    if (code) return code;
  }
  return null;
}
