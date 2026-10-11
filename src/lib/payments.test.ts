import { strict as assert } from "node:assert";
import { test } from "node:test";
import { monthLabel, monthOf, parseAmount, recentPayments, revenueForMonth, withoutTrainerMoney } from "./payments.ts";

test("parseAmount reads spaces, comma and dot; rejects empty, zero, negative and extra decimals", () => {
  assert.equal(parseAmount("1 200"), 1200);
  assert.equal(parseAmount("1200,5"), 1200.5);
  assert.equal(parseAmount("1200.50"), 1200.5);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("0"), null);
  assert.equal(parseAmount("-50"), null);
  assert.equal(parseAmount("12.345"), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("100001"), null);
});

test("revenueForMonth sums only payments of that month across clients", () => {
  const clients = [
    { payments: [{ id: "a", at: "2026-10-03", amount: 300, sessions: 4 }, { id: "b", at: "2026-09-28", amount: 999, sessions: 4 }] },
    { payments: [{ id: "c", at: "2026-10-12", amount: 150.5, sessions: 1 }] },
    {},
  ];
  assert.deepEqual(revenueForMonth(clients, "2026-10"), { sum: 450.5, count: 2 });
  assert.deepEqual(revenueForMonth(clients, "2026-08"), { sum: 0, count: 0 });
});

test("recentPayments: newest first, at most n", () => {
  const list = [
    { id: "1", at: "2026-10-01", amount: 1, sessions: 0 },
    { id: "2", at: "2026-10-05", amount: 1, sessions: 0 },
    { id: "3", at: "2026-09-20", amount: 1, sessions: 0 },
    { id: "4", at: "2026-10-05", amount: 1, sessions: 0 },
  ];
  assert.deepEqual(recentPayments(list, 3).map((p) => p.id), ["4", "2", "1"]);
  assert.deepEqual(recentPayments(undefined), []);
});

test("monthOf and monthLabel", () => {
  assert.equal(monthOf("2026-10-12"), "2026-10");
  assert.equal(monthLabel("2026-10"), "октябрь 2026");
});

test("withoutTrainerMoney removes price and payments and keeps the rest; input is not mutated", () => {
  const mine = { id: "c1", firstName: "Анна", price: 60, payments: [{ id: "p", at: "2026-10-01", amount: 60, sessions: 1 }] };
  const shared = withoutTrainerMoney(mine);
  assert.equal("price" in shared, false);
  assert.equal("payments" in shared, false);
  assert.equal(shared.firstName, "Анна");
  assert.equal(mine.price, 60, "original keeps its money fields");
});
