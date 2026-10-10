import { test } from "node:test";
import assert from "node:assert/strict";
import type { LiftLog } from "@/data/studio";
import { formatMmSs, liftLabel, previousLift, restSecondsLeft } from "./client-program.ts";

const lift = (o: Partial<LiftLog>): LiftLog =>
  ({ id: "x", date: "2026-10-08", exercise: "Жим лежа", weight: 60, reps: 8, sets: 3, clientId: "c1", ...o }) as LiftLog;

test("previous: the latest lift of this exercise before today, for this client only", () => {
  const lifts = [
    lift({ id: "a", date: "2026-10-01", weight: 50 }),
    lift({ id: "b", date: "2026-10-08", weight: 60 }),
    lift({ id: "c", date: "2026-10-10", weight: 70 }),
    lift({ id: "d", date: "2026-10-09", weight: 90, clientId: "other" }),
    lift({ id: "e", date: "2026-10-07", exercise: "Тяга", weight: 100 }),
  ];
  assert.equal(previousLift(lifts, "c1", "Жим лежа", "2026-10-10")?.id, "b", "today's own lift is not a previous result");
  assert.equal(previousLift(lifts, "c1", "Тяга", "2026-10-10")?.id, "e");
  assert.equal(previousLift(lifts, "c1", "Приседания", "2026-10-10"), null);
});

test("previous: label shows load and reps", () => {
  assert.equal(liftLabel(lift({ weight: 60, reps: 8 })), "60 кг × 8");
});

test("rest: counts down in whole seconds and stops at zero", () => {
  const t0 = 1_000_000;
  assert.equal(restSecondsLeft(null, t0), 0);
  assert.equal(restSecondsLeft(t0 + 90_000, t0), 90);
  assert.equal(restSecondsLeft(t0 + 1_500, t0), 2, "1.5 s left shows as 2, not 1");
  assert.equal(restSecondsLeft(t0 - 1, t0), 0);
});

test("rest: mm:ss format", () => {
  assert.equal(formatMmSs(90), "1:30");
  assert.equal(formatMmSs(5), "0:05");
  assert.equal(formatMmSs(0), "0:00");
});
