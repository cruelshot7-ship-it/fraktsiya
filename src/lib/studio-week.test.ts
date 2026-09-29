import assert from "node:assert/strict";
import test from "node:test";
import { relativeDayLabel } from "../data/studio.ts";

test("tomorrow and today have names, other days stay a weekday", () => {
  assert.equal(relativeDayLabel("2026-09-29", "2026-09-29"), "Сегодня");
  assert.equal(relativeDayLabel("2026-09-30", "2026-09-29"), "Завтра");
  assert.equal(relativeDayLabel("2026-10-01", "2026-09-29"), "Четверг, 1 октября");
});
