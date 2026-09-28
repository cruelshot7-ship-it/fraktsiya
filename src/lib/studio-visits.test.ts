import assert from "node:assert/strict";
import test from "node:test";
import { daysSinceVisit, withArrival } from "./studio-visits.ts";

test("one tap writes one visit and adds water again", () => {
  const first = withArrival([], "c1", "2026-09-28", "2026-09-28T06:00:00.000Z");
  assert.equal(first.length, 1);
  assert.equal(first[0].waterMl, 250);
  assert.equal(first[0].id, "visit_c1_2026-09-28");
  const second = withArrival(first, "c1", "2026-09-28", "2026-09-28T07:00:00.000Z");
  assert.equal(second.length, 1);
  assert.equal(second[0].waterMl, 500);
});

test("days since the last visit", () => {
  assert.equal(daysSinceVisit(["2026-09-18", "2026-09-20"], "2026-09-28"), 8);
  assert.equal(daysSinceVisit([], "2026-09-28"), null);
});
