import type { Client } from "@/data/studio";

export type WeightPoint = Client["weightHistory"][number];

const DAY_MS = 86_400_000;

/**
 * Изменение веса за 7 дней: последняя точка минус последняя точка не позже чем неделю назад.
 * Нет точки за неделю назад или меньше двух точек — null (подпись не показываем, а не пишем 0).
 */
export function weightChangeWeek(history: WeightPoint[]): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const cutoff = Date.parse(last.date) - 7 * DAY_MS;
  const base = sorted.slice(0, -1).reverse().find((p) => Date.parse(p.date) <= cutoff);
  if (!base) return null;
  return Math.round((last.kg - base.kg) * 10) / 10;
}
