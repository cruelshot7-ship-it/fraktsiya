import { ARRIVE_WATER, type Visit } from "../data/studio.ts";

export function withArrival(visits: Visit[], clientId: string, date: string, at: string, waterMl = ARRIVE_WATER): Visit[] {
  const id = `visit_${clientId}_${date}`;
  const prev = visits.find((row) => row.id === id);
  if (!prev) return [...visits, { id, clientId, date, at, waterMl }];
  return visits.map((row) => (row.id === id ? { ...row, at, waterMl: row.waterMl + waterMl } : row));
}

export function daysSinceVisit(dates: string[], today: string) {
  if (!dates.length) return null;
  const last = [...dates].sort().at(-1) ?? today;
  const from = Date.parse(`${last}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.round((to - from) / 86400000));
}
