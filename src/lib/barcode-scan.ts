/**
 * Чтение штрихкода из кадра камеры или фото в браузере.
 * Сначала нативный BarcodeDetector (Chrome, Android). Если его нет (Safari, iOS) — свой декодер EAN-13 по строкам пикселей.
 */
import { getBarcodeDetector } from "@/lib/barcode";
import { decodeEan13Row } from "@/lib/ean-decode";

/** Доли высоты кадра, по которым берём строки для декодера. Штрихкод может быть в любой части кадра. */
const VIDEO_ROWS = Array.from({ length: 20 }, (_, i) => 0.12 + i * 0.04);
const PHOTO_ROWS = Array.from({ length: 31 }, (_, i) => 0.05 + i * 0.03);
/** Ширина, до которой уменьшаем кадр: штрихи должны занимать несколько пикселей на модуль. */
const MAX_WIDTH = 960;

let canvas: HTMLCanvasElement | null = null;

/** Строки кадра в серых тонах; `rotate` — поворот на 90°, если штрихкод на фото вертикальный. */
function readRows(src: CanvasImageSource, w: number, h: number, rows: number[], rotate: boolean): string | null {
  if (typeof document === "undefined" || w < 1 || h < 1) return null;
  canvas ??= document.createElement("canvas");
  const scale = Math.min(1, MAX_WIDTH / (rotate ? h : w));
  const cw = Math.max(1, Math.round((rotate ? h : w) * scale));
  const ch = Math.max(1, Math.round((rotate ? w : h) * scale));
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.save();
  if (rotate) {
    ctx.translate(cw, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, 0, 0, ch, cw);
  } else {
    ctx.drawImage(src, 0, 0, cw, ch);
  }
  ctx.restore();
  for (const r of rows) {
    const y = Math.min(ch - 1, Math.round(ch * r));
    const data = ctx.getImageData(0, y, cw, 1).data;
    const gray = new Uint8Array(cw);
    for (let x = 0; x < cw; x++) {
      gray[x] = Math.round(data[4 * x] * 0.299 + data[4 * x + 1] * 0.587 + data[4 * x + 2] * 0.114);
    }
    const code = decodeEan13Row(gray);
    if (code) return code;
  }
  return null;
}

/** Свой декодер: горизонтально и повёрнутый кадр. */
export function decodeFromSource(src: CanvasImageSource, w: number, h: number, photo = false): string | null {
  const rows = photo ? PHOTO_ROWS : VIDEO_ROWS;
  return readRows(src, w, h, rows, false) ?? readRows(src, w, h, rows, true);
}

/** Код из кадра или фото: сначала нативный детектор, потом свой декодер. */
export async function readCode(src: CanvasImageSource, w: number, h: number, photo = false): Promise<string | null> {
  const detector = getBarcodeDetector();
  if (detector) {
    try {
      const codes = await detector.detect(src as ImageBitmapSource);
      const value = codes[0]?.rawValue;
      if (value) return value;
    } catch {
      /* пробуем свой декодер */
    }
  }
  return decodeFromSource(src, w, h, photo);
}
