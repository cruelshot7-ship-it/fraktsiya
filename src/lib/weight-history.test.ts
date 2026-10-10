import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeWeightHistory, weightNow } from "./weight-history.ts";

test("a stale copy does not remove a point the server got later", () => {
  const server = [
    { date: "2026-10-08", kg: 82 },
    { date: "2026-10-10", kg: 81.2 },
  ];
  const staleClient = [{ date: "2026-10-08", kg: 82 }];
  assert.deepEqual(mergeWeightHistory(server, staleClient), server);
});

test("new points from both sides are kept, sorted by date", () => {
  const server = [{ date: "2026-10-09", kg: 81.5 }];
  const trainer = [{ date: "2026-10-08", kg: 82 }, { date: "2026-10-10", kg: 81 }];
  assert.deepEqual(mergeWeightHistory(server, trainer), [
    { date: "2026-10-08", kg: 82 },
    { date: "2026-10-09", kg: 81.5 },
    { date: "2026-10-10", kg: 81 },
  ]);
});

test("for the same date the writer's value wins (a correction)", () => {
  const server = [{ date: "2026-10-10", kg: 81.2 }];
  const corrected = [{ date: "2026-10-10", kg: 80.9 }];
  assert.deepEqual(mergeWeightHistory(server, corrected), [{ date: "2026-10-10", kg: 80.9 }]);
});

test("empty sides merge to the other side", () => {
  assert.deepEqual(mergeWeightHistory(undefined, []), []);
  assert.deepEqual(mergeWeightHistory([], [{ date: "2026-10-10", kg: 80 }]), [{ date: "2026-10-10", kg: 80 }]);
});

test("current weight is the newest point, else the fallback", () => {
  const h = [{ date: "2026-10-08", kg: 82 }, { date: "2026-10-10", kg: 81.2 }];
  assert.equal(weightNow(h, 90), 81.2);
  assert.equal(weightNow([], 90), 90);
  assert.equal(weightNow([{ date: "2026-10-10", kg: 0 }], 90), 90, "a zero point is not a weight");
});
