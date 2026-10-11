import { strict as assert } from "node:assert";
import { test } from "node:test";
import { balanceSummary, daysUntil } from "./balance-summary.ts";

const TODAY = "2026-10-12";

test("prepaid sums remaining sessions, negatives count as zero", () => {
  const s = balanceSummary([{ sessionsLeft: 5 }, { sessionsLeft: 0 }, { sessionsLeft: -1 }, { sessionsLeft: null }], TODAY);
  assert.equal(s.prepaid, 5);
  assert.equal(s.empty, 3);
});

test("low counts 1 and 2 sessions, not 0 and not 3", () => {
  const s = balanceSummary([{ sessionsLeft: 1 }, { sessionsLeft: 2 }, { sessionsLeft: 3 }], TODAY);
  assert.equal(s.low, 2);
});

test("pack ending within 7 days with sessions left, including today", () => {
  const s = balanceSummary(
    [
      { sessionsLeft: 4, packExpiresAt: "2026-10-19" }, // +7 — counts
      { sessionsLeft: 4, packExpiresAt: "2026-10-20" }, // +8 — no
      { sessionsLeft: 4, packExpiresAt: "2026-10-12" }, // today — counts
      { sessionsLeft: 4, packExpiresAt: "2026-10-11" }, // passed — no
      { sessionsLeft: 0, packExpiresAt: "2026-10-14" }, // empty pack — no
      { sessionsLeft: 4, packExpiresAt: null }, // no expiry — no
    ],
    TODAY,
  );
  assert.equal(s.packsEndingSoon, 2);
});

test("daysUntil is calendar days, not hours", () => {
  assert.equal(daysUntil("2026-10-19", TODAY), 7);
  assert.equal(daysUntil("2026-10-11", TODAY), -1);
});
