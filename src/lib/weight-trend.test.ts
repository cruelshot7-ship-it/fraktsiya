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

import { weightSeries } from "./weight-trend.ts";

test("weight series: a 7-day range keeps points from the last week, sorted by date", () => {
  const history = [p("2026-10-01", 80), p("2026-10-09", 79.5), p("2026-10-05", 79.8), p("2026-10-12", 79.2)];
  assert.deepEqual(
    weightSeries(history, 7, "2026-10-12").map((x) => x.date),
    ["2026-10-05", "2026-10-09", "2026-10-12"],
  );
});

test("weight series: range 0 is the whole history, sorted; a future point is not shown", () => {
  const history = [p("2026-10-08", 79), p("2026-10-01", 80), p("2026-10-20", 70)];
  assert.deepEqual(
    weightSeries(history, 0, "2026-10-12").map((x) => x.date),
    ["2026-10-01", "2026-10-08", "2026-10-20"],
  );
  assert.deepEqual(
    weightSeries(history, 30, "2026-10-12").map((x) => x.date),
    ["2026-10-01", "2026-10-08"],
  );
});

test("weight series: empty history gives an empty list", () => {
  assert.deepEqual(weightSeries([], 30, "2026-10-12"), []);
});
