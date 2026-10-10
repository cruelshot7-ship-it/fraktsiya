/**
 * Small pure helpers for the client's program screen: the last result of an exercise, and the
 * rest countdown after a block. Kept out of the component so they run under node --test.
 */
import type { LiftLog } from "@/data/studio";
import { sameExercise } from "@/lib/exercises";

/** The latest recorded lift of this exercise before today: the "в прошлый раз" on a block. */
export function previousLift(lifts: LiftLog[], clientId: string, exercise: string, today: string): LiftLog | null {
  let best: LiftLog | null = null;
  for (const lift of lifts) {
    if (lift.clientId !== clientId || lift.date >= today || !sameExercise(lift.exercise, exercise)) continue;
    if (!best || lift.date >= best.date) best = lift;
  }
  return best;
}

/** "60 кг × 8" — the load and reps recorded last time. */
export function liftLabel(lift: LiftLog): string {
  return `${lift.weight} кг × ${lift.reps}`;
}

/** Seconds left on the rest countdown; 0 when it is over or not running. */
export function restSecondsLeft(restUntil: number | null, now: number): number {
  if (!restUntil) return 0;
  return Math.max(0, Math.ceil((restUntil - now) / 1000));
}

/** 90 -> "1:30", 5 -> "0:05". */
export function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
