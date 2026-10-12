import { strict as assert } from "node:assert";
import { test } from "node:test";
import { weightChangeWeek } from "./weight-trend.ts";

const p = (date: string, kg: number) => ({ date, kg });

test("change counts from the point a week back, not from the start of history", () => {
  const history = [p("2026-08-01", 90), p("2026-09-01", 85), p("2026-10-01", 84), p("2026-10-08", 83.4)];
  // last 83.4 minus point on or before 2026-10-01 (84) = -0.6
  assert.equal(weightChangeWeek(history), -0.6);
});

test("no point a week back, or fewer than two points, gives null (not zero)", () => {
  assert.equal(weightChangeWeek([]), null);
  assert.equal(weightChangeWeek([p("2026-10-01", 80)]), null);
  assert.equal(weightChangeWeek([p("2026-10-05", 80), p("2026-10-08", 79)]), null);
});

test("unsorted history is read by date", () => {
  const history = [p("2026-10-08", 79), p("2026-10-01", 80)];
  assert.equal(weightChangeWeek(history), -1);
});
