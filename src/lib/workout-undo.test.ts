import { test } from "node:test";
import assert from "node:assert/strict";
import { activeLogFor, canUndoWorkout, UNDO_WINDOW_MS } from "./workout-undo.ts";
import type { WorkoutLog } from "@/data/studio";

// fixtures only need the fields the helpers read
const L = (o: Record<string, unknown>) => o as unknown as WorkoutLog;

const at = "2026-10-10T12:00:00.000Z";
const t0 = Date.parse(at);
const undo = { lastReportAt: null, streak: 3, bookingId: "b1" };

test("undo: allowed inside the window, refused after it", () => {
  const log = { at, undo };
  assert.equal(canUndoWorkout(log, t0 + 60_000), true);
  assert.equal(canUndoWorkout(log, t0 + UNDO_WINDOW_MS), true, "exactly 20 minutes still counts");
  assert.equal(canUndoWorkout(log, t0 + UNDO_WINDOW_MS + 1), false);
});

test("undo: refused when already cancelled, without a snapshot, or for a broken date", () => {
  assert.equal(canUndoWorkout({ at, undo, cancelledAt: at }, t0 + 1), false);
  assert.equal(canUndoWorkout({ at }, t0 + 1), false, "old logs have no snapshot: nothing safe to restore");
  assert.equal(canUndoWorkout({ at: "не дата", undo }, t0 + 1), false);
  assert.equal(canUndoWorkout(null, t0), false);
});

test("undo: a timestamp in the future is not undone", () => {
  assert.equal(canUndoWorkout({ at, undo }, t0 - 5_000), false);
});

test("active log: cancelled ones are skipped, the latest live one wins", () => {
  const old = L({ id: "a", at: "2026-10-10T10:00:00.000Z" });
  const cancelled = L({ id: "b", at: "2026-10-10T11:00:00.000Z", cancelledAt: "2026-10-10T11:05:00.000Z" });
  const redo = L({ id: "c", at: "2026-10-10T11:30:00.000Z" });
  assert.equal(activeLogFor([old, cancelled, redo])?.id, "c");
  assert.equal(activeLogFor([cancelled]), null, "only cancelled: nothing counts");
  assert.equal(activeLogFor([]), null);
});
