/**
 * Reopening a finished workout. Long enough to fix a mis-tap, short enough that the record
 * stays final. Pure, so it runs under node --test (the type import is erased at runtime).
 */
import type { WorkoutLog } from "@/data/studio";

export const UNDO_WINDOW_MS = 20 * 60 * 1000;

/** What finishing a workout changed, so that undoing it can put the same values back. */
export type UndoSnapshot = {
  lastReportAt: string | null;
  streak: number;
  /** booking whose check-in finishing set; null when it was already checked in or there was none */
  bookingId: string | null;
};

type LogLike = { at: string; cancelledAt?: string; undo?: UndoSnapshot };

export function canUndoWorkout(log: LogLike | null | undefined, now: number): boolean {
  if (!log || log.cancelledAt || !log.undo) return false;
  const at = Date.parse(log.at);
  if (Number.isNaN(at)) return false;
  const age = now - at;
  return age >= 0 && age <= UNDO_WINDOW_MS;
}

/**
 * The workout that counts for a day: the latest one that was not cancelled. A cancelled log is
 * kept (not deleted) so a sync merge cannot bring it back as a live workout.
 */
export function activeLogFor(logs: WorkoutLog[]): WorkoutLog | null {
  let best: WorkoutLog | null = null;
  for (const log of logs) {
    if (log.cancelledAt) continue;
    if (!best || Date.parse(log.at) > Date.parse(best.at)) best = log;
  }
  return best;
}
