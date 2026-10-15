import assert from "node:assert/strict";
import test from "node:test";
import { dropCheckIds, dayKeyOf, mergeChecks } from "./checks-merge.ts";

const DAY = "c1:2026-10-15";

test("day key strips the sets and stamp suffixes", () => {
  assert.equal(dayKeyOf(`${DAY}:sets`), DAY);
  assert.equal(dayKeyOf(`${DAY}:at`), DAY);
  assert.equal(dayKeyOf(DAY), DAY);
});

test("newer copy wins the whole day, so a client's mark is not wiped by a stale trainer copy", () => {
  const server = { [DAY]: ["a", "b"], [`${DAY}:sets`]: ["a#0", "b#0"], [`${DAY}:at`]: ["200"] };
  const staleTrainer = { [DAY]: ["a"], [`${DAY}:sets`]: ["a#0"], [`${DAY}:at`]: ["100"] };
  const merged = mergeChecks(server, staleTrainer, new Set(["c1"]));
  assert.deepEqual(merged[DAY], ["a", "b"]);
  assert.deepEqual(merged[`${DAY}:sets`], ["a#0", "b#0"]);
});

test("a newer trainer mark reaches the client's copy", () => {
  const local = { [DAY]: ["a"], [`${DAY}:at`]: ["100"] };
  const server = { [DAY]: ["a", "b"], [`${DAY}:sets`]: ["b#0"], [`${DAY}:at`]: ["300"] };
  const merged = mergeChecks(local, server, null);
  assert.deepEqual(merged[DAY], ["a", "b"]);
  assert.deepEqual(merged[`${DAY}:sets`], ["b#0"]);
});

test("an unmark is kept: an empty newer day beats the older marks", () => {
  const server = { [DAY]: ["a"], [`${DAY}:at`]: ["100"] };
  const local = { [DAY]: [], [`${DAY}:at`]: ["200"] };
  assert.deepEqual(mergeChecks(server, local, null)[DAY], []);
});

test("equal stamps keep the incoming copy, as before", () => {
  const current = { [DAY]: ["x"] };
  const incoming = { [DAY]: ["y"] };
  assert.deepEqual(mergeChecks(current, incoming, null)[DAY], ["y"]);
});

test("keys outside the scope stay as they are", () => {
  const current = { [DAY]: ["a"], "c2:2026-10-15": ["z"] };
  const incoming = { [DAY]: [], "c2:2026-10-15": [] };
  const merged = mergeChecks(current, incoming, new Set(["c1"]));
  assert.deepEqual(merged["c2:2026-10-15"], ["z"]);
  assert.deepEqual(merged[DAY], []);
});

test("dropCheckIds removes only the listed clients", () => {
  const checks = { [DAY]: ["a"], "c2:2026-10-15": ["z"] };
  assert.deepEqual(dropCheckIds(checks, new Set(["c1"])), { "c2:2026-10-15": ["z"] });
});
