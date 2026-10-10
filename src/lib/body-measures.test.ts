import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildMeasure, changeSinceFirst, latestValue, parseCm, upsertMeasure, type BodyMeasure } from "./body-measures.ts";

test("parseCm accepts comma decimals and rejects empty or out of range", () => {
  assert.equal(parseCm("85,5", 40, 200), 85.5);
  assert.equal(parseCm(" 90 ", 40, 200), 90);
  assert.equal(parseCm("", 40, 200), null);
  assert.equal(parseCm("abc", 40, 200), null);
  assert.equal(parseCm("5", 40, 200), null);
  assert.equal(parseCm("201", 40, 200), null);
});

test("buildMeasure needs at least one field and reports bad values by name", () => {
  const empty = buildMeasure("2026-10-10", {});
  assert.equal(empty.ok, false);
  const bad = buildMeasure("2026-10-10", { waist: "3" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.reason, /талия/);
  const good = buildMeasure("2026-10-10", { chest: "100", waist: "82,4", arm: "" });
  assert.deepEqual(good, { ok: true, measure: { date: "2026-10-10", chest: 100, waist: 82.4 } });
});

test("upsertMeasure replaces the same day and keeps date order", () => {
  const list: BodyMeasure[] = [{ date: "2026-10-05", waist: 84 }];
  const next = upsertMeasure(list, { date: "2026-10-01", waist: 86 });
  assert.deepEqual(next.map((m) => m.date), ["2026-10-01", "2026-10-05"]);
  const again = upsertMeasure(next, { date: "2026-10-05", waist: 83 });
  assert.equal(again.length, 2);
  assert.equal(again[1].waist, 83);
});

test("latestValue skips days where the field was not measured", () => {
  const list: BodyMeasure[] = [
    { date: "2026-10-01", hip: 100, waist: 86 },
    { date: "2026-10-08", hip: 99 },
  ];
  assert.deepEqual(latestValue(list, "waist"), { value: 86, date: "2026-10-01" });
  assert.deepEqual(latestValue(list, "hip"), { value: 99, date: "2026-10-08" });
  assert.equal(latestValue(list, "chest"), null);
});

test("changeSinceFirst needs two points and rounds to 0.1 cm", () => {
  const list: BodyMeasure[] = [
    { date: "2026-10-01", waist: 86.2 },
    { date: "2026-10-08", chest: 100 },
    { date: "2026-10-15", waist: 84.9 },
  ];
  assert.equal(changeSinceFirst(list, "waist"), -1.3);
  assert.equal(changeSinceFirst(list, "chest"), null);
  assert.equal(changeSinceFirst([{ date: "2026-10-01", waist: 86 }], "waist"), null);
});
