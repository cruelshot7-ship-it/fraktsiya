import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PRIVACY_VERSION } from "./privacy.ts";
import { guardBodyFields, guardRows, healthWriteAllowed } from "./health-write-gate.ts";

test("health writes need an accepted current policy version", () => {
  assert.equal(healthWriteAllowed(null), false);
  assert.equal(healthWriteAllowed({ version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "x" }), false);
  assert.equal(healthWriteAllowed({ version: "2026-01-01.1", acceptedAt: "x" }), false, "old version does not count");
  assert.equal(healthWriteAllowed({ version: PRIVACY_VERSION, acceptedAt: "2026-10-12T10:00:00Z" }), true);
});

test("without consent the stored body fields stay as they were", () => {
  const stored = { weight: 80, weightHistory: [{ date: "2026-10-01", kg: 80 }] };
  const merged = { weight: 79, weightHistory: [{ date: "2026-10-01", kg: 80 }, { date: "2026-10-12", kg: 79 }] };
  assert.deepEqual(guardBodyFields(false, stored, merged), stored);
  assert.deepEqual(guardBodyFields(true, stored, merged), merged);
});

test("without consent the client's stored rows stay; incoming rows are not written", () => {
  const stored = [{ clientId: "c1", date: "2026-10-01", steps: 8000 }];
  const merged = [
    { clientId: "c1", date: "2026-10-01", steps: 8000 },
    { clientId: "c1", date: "2026-10-12", steps: 12000 },
  ];
  assert.deepEqual(guardRows(false, stored, merged), stored, "a refused write must not change stored rows");
  assert.deepEqual(guardRows(true, stored, merged), merged);
});

test("a refused write with no stored rows keeps none", () => {
  const merged = [{ clientId: "c1", date: "2026-10-12", steps: 12000 }];
  assert.deepEqual(guardRows(false, [], merged), []);
});
