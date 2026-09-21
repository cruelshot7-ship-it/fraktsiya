import type { Kbju } from "@/data/studio";

export type ScanProduct = {
  barcode: string;
  name: string;
  brand?: string;
  per100: Kbju;
  source: "local" | "off" | "cache" | "studio";
  quantity?: string;
  servingGrams?: number;
  incomplete?: boolean;
  stale?: boolean;
  image?: string;
};

/** Local pack so scan works without the camera and if Open Food Facts is down. Per 100 g. */
export const BARCODE_CATALOG: Record<string, Omit<ScanProduct, "source" | "barcode">> = {
  "3017620422003": {
    name: "Nutella",
    brand: "Ferrero",
    per100: { calories: 539, protein: 6.3, fat: 30.9, carbs: 57.5 },
  },
  "5449000000996": {
    name: "Coca-Cola",
    brand: "Coca-Cola",
    per100: { calories: 42, protein: 0, fat: 0, carbs: 10.6 },
  },
  "4600690101081": {
    name: "Молоко 2,5%",
    brand: "Простоквашино",
    per100: { calories: 53, protein: 2.8, fat: 2.5, carbs: 4.7 },
  },
  "4810168030018": {
    name: "Творог 5%",
    brand: "Савушкин",
    per100: { calories: 121, protein: 17, fat: 5, carbs: 1.8 },
  },
  "4607065001553": {
    name: "Гречка ядрица",
    brand: "Мистраль",
    per100: { calories: 334, protein: 12.6, fat: 3.3, carbs: 62 },
  },
  "4600690102555": {
    name: "Кефир 2,5%",
    brand: "Простоквашино",
    per100: { calories: 53, protein: 2.9, fat: 2.5, carbs: 4 },
  },
  "2000000000012": {
    name: "Протеин-шейк студии",
    brand: "Ruksha",
    per100: { calories: 80, protein: 10.7, fat: 1.3, carbs: 6 },
  },
};

export const DEMO_BARCODES: { code: string; label: string }[] = [
  { code: "4810168030018", label: "Творог" },
  { code: "4600690101081", label: "Молоко" },
  { code: "3017620422003", label: "Nutella" },
  { code: "2000000000012", label: "Шейк зала" },
];

export function scaleKbju(per100: Kbju, grams: number): Kbju {
  const k = Math.max(1, grams) / 100;
  const n = (v: number) => Math.round(v * k * 10) / 10;
  return {
    calories: Math.round(per100.calories * k),
    protein: n(per100.protein),
    fat: n(per100.fat),
    carbs: n(per100.carbs),
  };
}
