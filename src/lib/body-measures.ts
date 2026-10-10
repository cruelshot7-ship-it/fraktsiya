/**
 * Body measurements in cm, entered by the client. Pure functions, no imports.
 * Stored per client as an array, one row per calendar day (the last entry wins).
 */

export const MEASURE_FIELDS = [
  { key: "chest", label: "Грудь", min: 40, max: 200 },
  { key: "waist", label: "Талия", min: 40, max: 200 },
  { key: "belly", label: "Живот", min: 40, max: 200 },
  { key: "armLeft", label: "Левая рука", min: 15, max: 80 },
  { key: "armRight", label: "Правая рука", min: 15, max: 80 },
  { key: "thighLeft", label: "Левое бедро", min: 25, max: 120 },
  { key: "thighRight", label: "Правое бедро", min: 25, max: 120 },
  { key: "hips", label: "Обхват бёдер", min: 50, max: 200 },
] as const;

export type MeasureKey = (typeof MEASURE_FIELDS)[number]["key"];

export type BodyMeasure = { date: string } & Partial<Record<MeasureKey, number>>;

/** "85,5" -> 85.5. Empty -> null. Out of the field's range -> null. */
export function parseCm(raw: string, min: number, max: number): number | null {
  const text = raw.trim().replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return Math.round(value * 10) / 10;
}

export type MeasureInput = Partial<Record<MeasureKey, string>>;

/** Builds one day's row. At least one field must be filled, otherwise it is an error. */
export function buildMeasure(
  date: string,
  input: MeasureInput,
): { ok: true; measure: BodyMeasure } | { ok: false; reason: string } {
  const measure: BodyMeasure = { date };
  const bad: string[] = [];
  for (const field of MEASURE_FIELDS) {
    const raw = input[field.key];
    if (raw === undefined || raw.trim() === "") continue;
    const value = parseCm(raw, field.min, field.max);
    if (value === null) bad.push(`${field.label.toLowerCase()}: ${field.min}–${field.max} см`);
    else measure[field.key] = value;
  }
  if (bad.length) return { ok: false, reason: `Проверьте значения: ${bad.join("; ")}.` };
  const filled = MEASURE_FIELDS.some((field) => measure[field.key] !== undefined);
  if (!filled) return { ok: false, reason: "Введите хотя бы один замер." };
  return { ok: true, measure };
}

/** Replaces the row for the same date and keeps the list sorted by date. */
export function upsertMeasure(list: BodyMeasure[], row: BodyMeasure): BodyMeasure[] {
  return [...list.filter((m) => m.date !== row.date), row].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestValue(list: BodyMeasure[], key: MeasureKey): { value: number; date: string } | null {
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const value = list[i][key];
    if (value !== undefined) return { value, date: list[i].date };
  }
  return null;
}

/** Latest minus first recorded value for one field. Needs at least two records. */
export function changeSinceFirst(list: BodyMeasure[], key: MeasureKey): number | null {
  const points = list.filter((m) => m[key] !== undefined);
  if (points.length < 2) return null;
  const change = (points[points.length - 1][key] as number) - (points[0][key] as number);
  return Math.round(change * 10) / 10;
}

/**
 * Union by calendar day, so a copy that is missing a day cannot delete it.
 * Rows from `incoming` win for the same day (the client edits its own rows).
 */
export function mergeMeasures(base: BodyMeasure[] = [], incoming: BodyMeasure[] = []): BodyMeasure[] {
  const byDate = new Map(base.map((m) => [m.date, m]));
  for (const m of incoming) byDate.set(m.date, m);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
