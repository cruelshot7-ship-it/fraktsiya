import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAccessClient,
  canDecideProgression,
  canManageSlot,
  canRecordSessionResult,
  progressionBlockedByDiscomfort,
} from "./stage1-rules.ts";

describe("canManageSlot", () => {
  it("blocks trainer from foreign slot", () => {
    assert.equal(canManageSlot("trainer", "coach_a", "coach_b"), false);
  });
  it("allows owner trainer", () => {
    assert.equal(canManageSlot("trainer", "coach_a", "coach_a"), true);
  });
  it("blocks client", () => {
    assert.equal(canManageSlot("client", "c1", "coach_a"), false);
  });
});

describe("canAccessClient", () => {
  it("blocks trainer from foreign client", () => {
    assert.equal(canAccessClient("trainer", "coach_a", "coach_b", "user_x"), false);
  });
  it("allows linked trainer", () => {
    assert.equal(canAccessClient("trainer", "coach_a", "coach_a", "user_x"), true);
  });
  it("client sees only self", () => {
    assert.equal(canAccessClient("client", "user_x", "coach_a", "user_x"), true);
    assert.equal(canAccessClient("client", "user_x", "coach_a", "user_y"), false);
  });
});

describe("canRecordSessionResult", () => {
  it("rejects without attendance", () => {
    const r = canRecordSessionResult({ attendanceConfirmed: false, alreadyRecordedForExercise: false });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "no_attendance");
  });
  it("rejects duplicate exercise on same session", () => {
    const r = canRecordSessionResult({ attendanceConfirmed: true, alreadyRecordedForExercise: true });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "duplicate_exercise");
  });
  it("allows first result after attendance", () => {
    const r = canRecordSessionResult({ attendanceConfirmed: true, alreadyRecordedForExercise: false });
    assert.equal(r.ok, true);
  });
});

describe("canDecideProgression", () => {
  it("only owning trainer", () => {
    assert.equal(canDecideProgression("trainer", "coach_a", "coach_a"), true);
    assert.equal(canDecideProgression("trainer", "coach_b", "coach_a"), false);
    assert.equal(canDecideProgression("client", "user_x", "coach_a"), false);
  });
});

describe("progressionBlockedByDiscomfort", () => {
  it("flags discomfort notes without diagnosing", () => {
    assert.equal(progressionBlockedByDiscomfort("лёгкий дискомфорт в плече"), true);
    assert.equal(progressionBlockedByDiscomfort("всё ок"), false);
  });
});
