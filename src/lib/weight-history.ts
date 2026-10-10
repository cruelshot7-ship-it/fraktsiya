/**
 * Weight history is written from two places: the client's own log and the trainer's editor.
 * Each push carries a copy of the whole history that may be older than the server's, so a
 * history is merged by date, never replaced. The current weight is the newest point's kg.
 * Pure, no imports, so it runs under node --test.
 */
export type WeightPoint = { date: string; kg: number };

/**
 * Union by date. For a date both sides have, the writer's value wins (a correction the writer
 * just made); dates only on the server stay, so a stale copy cannot remove a newer point.
 */
export function mergeWeightHistory(server: WeightPoint[] = [], incoming: WeightPoint[] = []): WeightPoint[] {
  const byDate = new Map<string, WeightPoint>();
  for (const p of server) byDate.set(p.date, p);
  for (const p of incoming) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Current weight: the newest point's kg, or the fallback when there is no history. */
export function weightNow(history: WeightPoint[], fallback: number): number {
  const last = history.at(-1);
  return last && last.kg > 0 ? last.kg : fallback;
}
