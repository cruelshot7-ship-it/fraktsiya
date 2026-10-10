import { strict as assert } from "node:assert";
import { test } from "node:test";
import { keepClientOwned } from "./client-owned.ts";
import { mergeMeasures } from "./body-measures.ts";

const row = (date: string, chest: number) => ({ date, chest });

test("mergeMeasures keeps days the other copy does not have", () => {
  const server = [row("2026-10-01", 90), row("2026-10-05", 91)];
  const stale = [row("2026-10-01", 90)];
  const merged = mergeMeasures(server, stale);
  assert.equal(merged.length, 2);
});

test("mergeMeasures: incoming wins for the same day, sorted by date", () => {
  const merged = mergeMeasures([row("2026-10-05", 91), row("2026-10-01", 90)], [row("2026-10-05", 92)]);
  assert.deepEqual(merged, [row("2026-10-01", 90), row("2026-10-05", 92)]);
});

test("mergeMeasures handles missing lists", () => {
  assert.deepEqual(mergeMeasures(undefined, [row("2026-10-01", 90)]), [row("2026-10-01", 90)]);
  assert.deepEqual(mergeMeasures([row("2026-10-01", 90)], undefined), [row("2026-10-01", 90)]);
});

test("a trainer copy cannot wipe the client's measures, consent or erasure stamp", () => {
  const server = {
    id: "c1",
    weight: 80,
    measures: [row("2026-10-01", 90), row("2026-10-09", 89)],
    consent: { version: "2026-10-10", acceptedAt: "2026-10-10T07:00:00.000Z" },
    erasedAt: null,
  };
  const trainerCopy = { id: "c1", weight: 82, measures: [row("2026-10-01", 90)], consent: null, erasedAt: null };
  const out = keepClientOwned(server as never, trainerCopy as never) as unknown as typeof server & { weight: number };
  assert.equal(out.measures.length, 2);
  assert.equal(out.consent?.acceptedAt, "2026-10-10T07:00:00.000Z");
  assert.equal(out.weight, 82, "weight stays trainer-editable");
});

test("streak and last report date come from the server copy", () => {
  const out = keepClientOwned({ id: "c1", streak: 5, lastReportAt: "2026-10-09" } as never, { id: "c1", streak: 0 } as never);
  assert.equal(out.streak, 5);
  assert.equal(out.lastReportAt, "2026-10-09");
});

test("a new client (no server copy) keeps the incoming copy as is", () => {
  const fresh = { id: "c2", measures: [row("2026-10-01", 90)] };
  assert.equal(keepClientOwned(undefined, fresh as never), fresh);
});
