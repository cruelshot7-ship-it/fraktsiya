/**
 * Pure rules for slot / booking overlap (server should enforce the same).
 * Times are local wall HH:MM on the same date key YYYY-MM-DD.
 */

export type Timed = { date: string; time: string; durationMin: number };

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function rangesOverlap(a: Timed, b: Timed): boolean {
  if (a.date !== b.date) return false;
  const a0 = toMinutes(a.time);
  const a1 = a0 + a.durationMin;
  const b0 = toMinutes(b.time);
  const b1 = b0 + b.durationMin;
  return a0 < b1 && b0 < a1;
}

/** Trainer cannot open two overlapping own slots. */
export function trainerSlotsConflict(
  existing: Timed[],
  candidate: Timed,
): boolean {
  return existing.some((s) => rangesOverlap(s, candidate));
}

/** Client cannot hold two overlapping active bookings. */
export function clientBookingsConflict(
  existing: Timed[],
  candidate: Timed,
): boolean {
  return existing.some((s) => rangesOverlap(s, candidate));
}
