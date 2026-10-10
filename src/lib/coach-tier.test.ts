import { test } from "node:test";
import assert from "node:assert/strict";
import { clientsWord, coachTierLine, coachTierUsd } from "./coach-tier.ts";

test("tiers: $10 up to 10, $15 for 11–20, $20 from 21", () => {
  assert.equal(coachTierUsd(0), 10);
  assert.equal(coachTierUsd(10), 10);
  assert.equal(coachTierUsd(11), 15);
  assert.equal(coachTierUsd(14), 15);
  assert.equal(coachTierUsd(20), 15);
  assert.equal(coachTierUsd(21), 20);
  assert.equal(coachTierUsd(200), 20);
});

test("tiers: bad counts are read as zero, not as a crash", () => {
  assert.equal(coachTierUsd(-3), 10);
  assert.equal(coachTierUsd(Number.NaN), 10);
  assert.equal(coachTierUsd(10.9), 10);
});

test("plural: клиент / клиента / клиентов", () => {
  assert.equal(clientsWord(1), "клиент");
  assert.equal(clientsWord(2), "клиента");
  assert.equal(clientsWord(4), "клиента");
  assert.equal(clientsWord(5), "клиентов");
  assert.equal(clientsWord(11), "клиентов");
  assert.equal(clientsWord(12), "клиентов");
  assert.equal(clientsWord(14), "клиентов");
  assert.equal(clientsWord(21), "клиент");
  assert.equal(clientsWord(22), "клиента");
});

test("line: count, word and monthly amount", () => {
  assert.equal(coachTierLine(1), "1 клиент · $10 в месяц");
  assert.equal(coachTierLine(22), "22 клиента · $20 в месяц");
  assert.equal(coachTierLine(31), "31 клиент · $20 в месяц");
  assert.equal(coachTierLine(15), "15 клиентов · $15 в месяц");
  assert.equal(coachTierLine(10), "10 клиентов · $10 в месяц");
});
