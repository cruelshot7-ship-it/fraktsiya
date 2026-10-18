import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLowSessions, isNoTraining, isSnoozed, needsAttention, NO_TRAINING_DAYS } from "./attention-rule.ts";

describe("attention rule", () => {
  it("2 sessions or fewer, including zero, is low", () => {
    assert.equal(isLowSessions(0), true);
    assert.equal(isLowSessions(1), true);
    assert.equal(isLowSessions(2), true);
    assert.equal(isLowSessions(3), false);
  });

  it("no training for more than 14 days, not 14 itself", () => {
    assert.equal(NO_TRAINING_DAYS, 14);
    assert.equal(isNoTraining(14), false);
    assert.equal(isNoTraining(15), true);
  });

  it("enough sessions and trained recently → no attention", () => {
    assert.equal(needsAttention({ sessionsLeft: 10, daysSinceActivity: 3, frozen: false }), false);
  });

  it("low sessions or no training → attention", () => {
    assert.equal(needsAttention({ sessionsLeft: 1, daysSinceActivity: 1, frozen: false }), true);
    assert.equal(needsAttention({ sessionsLeft: 10, daysSinceActivity: 20, frozen: false }), true);
  });

  it("frozen client is never in attention", () => {
    assert.equal(needsAttention({ sessionsLeft: 0, daysSinceActivity: 99, frozen: true }), false);
  });

  it("snooze holds through its last day, then expires by itself", () => {
    assert.equal(isSnoozed(null, "2026-10-18"), false);
    assert.equal(isSnoozed(undefined, "2026-10-18"), false);
    assert.equal(isSnoozed("2026-10-25", "2026-10-18"), true);
    assert.equal(isSnoozed("2026-10-18", "2026-10-18"), true);
    assert.equal(isSnoozed("2026-10-17", "2026-10-18"), false);
  });
});
