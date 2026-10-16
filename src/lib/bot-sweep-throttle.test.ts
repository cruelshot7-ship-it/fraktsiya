import { test } from "node:test";
import assert from "node:assert/strict";
import { sweepDue } from "./bot-sweep-throttle.ts";

const TEN_MIN = 10 * 60_000;

test("sweep runs the first time and then at most once per interval", () => {
  assert.equal(sweepDue(1_000_000, 0, TEN_MIN), true);
  assert.equal(sweepDue(1_000_000, 1_000_000 - 60_000, TEN_MIN), false);
  assert.equal(sweepDue(1_000_000, 1_000_000 - TEN_MIN, TEN_MIN), true);
});
