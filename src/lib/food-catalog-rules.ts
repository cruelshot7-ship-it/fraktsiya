import { isValidGtin, normalizeGtin } from "@/lib/gtin";

/**
 * Checks for a product added to the shared catalog. Pure, so it is tested without the server.
 * Only real barcodes (8–14 digits) are accepted: manual entries without a code stay on the device.
 */
export const FOOD_CATALOG_CAP = 2000;

export type SharedFood = {
  barcode: string;
  name: string;
  brand?: string;
  per100: { calories: number; protein: number; fat: number; carbs: number };
  quantity?: string;
  servingGrams?: number;
};

export type FoodCheck = { ok: true; value: SharedFood } | { ok: false; reason: string };

const round1 = (value: number) => Math.round(value * 10) / 10;

export function checkFoodProduct(raw: unknown): FoodCheck {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "shape" };
  const r = raw as Record<string, unknown>;
  const digits = typeof r.barcode === "string" ? r.barcode.trim() : "";
  // только цифровые коды: ручные «manual_…» не уходят в общий каталог
  if (!/^\d{8,14}$/.test(digits)) return { ok: false, reason: "barcode" };
  const barcode = normalizeGtin(digits);
  // контрольная цифра: код с опечаткой не совпадёт ни с одной упаковкой
  if (!isValidGtin(barcode)) return { ok: false, reason: "barcode" };
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < 2 || name.length > 120) return { ok: false, reason: "name" };
  const brand = typeof r.brand === "string" ? r.brand.trim().slice(0, 80) : "";
  const p = (r.per100 ?? {}) as Record<string, unknown>;
  const inRange = (value: unknown, max: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max;
  if (!inRange(p.calories, 900) || !inRange(p.protein, 100) || !inRange(p.fat, 100) || !inRange(p.carbs, 100)) {
    return { ok: false, reason: "per100" };
  }
  const protein = p.protein as number;
  const fat = p.fat as number;
  const carbs = p.carbs as number;
  // grams per 100 g of product: the three macros cannot add up to more than the product itself
  if (protein + fat + carbs > 105) return { ok: false, reason: "macros" };
  const quantity = typeof r.quantity === "string" ? r.quantity.trim().slice(0, 40) : "";
  let servingGrams: number | undefined;
  if (r.servingGrams != null) {
    if (!inRange(r.servingGrams, 2000) || (r.servingGrams as number) < 1) return { ok: false, reason: "serving" };
    servingGrams = Math.round(r.servingGrams as number);
  }
  return {
    ok: true,
    value: {
      barcode,
      name,
      brand: brand || undefined,
      per100: {
        calories: round1(p.calories as number),
        protein: round1(protein),
        fat: round1(fat),
        carbs: round1(carbs),
      },
      quantity: quantity || undefined,
      servingGrams,
    },
  };
}
