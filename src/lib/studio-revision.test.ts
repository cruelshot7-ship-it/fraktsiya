import { test } from "node:test";
import assert from "node:assert/strict";
import { isRevisioned, nextRevision, readRevision } from "@/lib/studio-revision";

test("readRevision: missing, invalid and negative values count as 0", () => {
  assert.equal(readRevision(null), 0);
  assert.equal(readRevision(undefined), 0);
  assert.equal(readRevision({}), 0);
  assert.equal(readRevision({ rev: undefined }), 0);
  assert.equal(readRevision({ rev: -1 }), 0);
  assert.equal(readRevision({ rev: 1.5 }), 0);
  assert.equal(readRevision({ rev: Number.NaN }), 0);
  assert.equal(readRevision({ rev: "3" as unknown as number }), 0);
});

test("readRevision: a valid integer is returned as is", () => {
  assert.equal(readRevision({ rev: 0 }), 0);
  assert.equal(readRevision({ rev: 7 }), 7);
});

test("nextRevision: one more than the revision the state was read with", () => {
  assert.equal(nextRevision(null), 1);
  assert.equal(nextRevision({}), 1);
  assert.equal(nextRevision({ rev: 4 }), 5);
});

test("isRevisioned: only a numeric rev marks a row written after revisions", () => {
  assert.equal(isRevisioned({}), false);
  assert.equal(isRevisioned(null), false);
  assert.equal(isRevisioned({ rev: 0 }), true);
  assert.equal(isRevisioned({ rev: 12 }), true);
});
