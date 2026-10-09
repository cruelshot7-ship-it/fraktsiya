import assert from "node:assert/strict";
import test from "node:test";
import {
  calorieAdvice,
  detectPRs,
  e1rm,
  e1rmTrend,
  readiness,
  reducedSets,
  weightTrend,
  type ReadinessDay,
  type SetEntry,
  type WeightTrend,
} from "./athlete-metrics.ts";

const set = (date: string, weight: number, reps: number, rir?: number, exercise = "жим"): SetEntry => ({
  date,
  exercise,
  weight,
  reps,
  rir,
});

test("e1RM uses reps to failure: 100 x 5 @ RIR 2 -> 100 * (1 + 7/30)", () => {
  assert.equal(e1rm(100, 5, 2), 123.3);
  assert.equal(e1rm(100, 5, 0), 116.7);
  assert.equal(e1rm(80, 8, 0), 101.3);
  assert.equal(e1rm(100, 1, 0), 100);
  assert.equal(e1rm(0, 5, 0), 0);
});

test("PR: first set is a baseline, equal result is not a PR, high-rep sets are ignored", () => {
  const prs = detectPRs([
    set("2026-09-01", 100, 5, 0),
    set("2026-09-08", 100, 5, 2),
    set("2026-09-15", 100, 5, 2),
    set("2026-09-22", 60, 15, 0),
  ]);
  assert.equal(prs.length, 1);
  assert.deepEqual(prs[0], { date: "2026-09-08", exercise: "жим", e1rm: 123.3, previous: 116.7, gain: 6.6 });
});

test("e1RM trend: +2 kg per session each week gives exactly 2 kg/week", () => {
  const sets = [100, 102, 104, 106].map((w, i) => set(`2026-09-${String(1 + i * 7).padStart(2, "0")}`, w, 1, 0));
  const t = e1rmTrend(sets, "жим");
  assert.equal(t.status, "ok");
  if (t.status === "ok") {
    assert.equal(t.kgPerWeek, 2);
    assert.equal(t.sessions, 4);
    assert.equal(t.spanDays, 21);
    assert.equal(t.latest, 106);
  }
});

test("e1RM trend refuses thin data", () => {
  assert.equal(e1rmTrend([set("2026-09-01", 100, 1, 0), set("2026-09-08", 102, 1, 0)], "жим").status, "insufficient");
  const short = [set("2026-09-01", 100, 1, 0), set("2026-09-05", 101, 1, 0), set("2026-09-10", 102, 1, 0)];
  assert.equal(e1rmTrend(short, "жим").status, "insufficient");
});

test("readiness: pain 3 skips, pain 2 modifies, two flags reduce", () => {
  const hist: ReadinessDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    sleepHours: 7.5,
    fatigue: 2,
    soreness: 2,
    pain: 0,
  }));
  assert.equal(readiness({ date: "2026-09-10", sleepHours: 7, fatigue: 2, soreness: 2, pain: 3 }, hist).status, "skip");
  assert.equal(readiness({ date: "2026-09-10", sleepHours: 7, fatigue: 2, soreness: 2, pain: 2 }, hist).status, "modify");
  const reduce = readiness({ date: "2026-09-10", sleepHours: 5, fatigue: 4, soreness: 2, pain: 0 }, hist);
  assert.equal(reduce.status, "reduce");
  if (reduce.status === "reduce") assert.equal(reduce.setFactor, 0.8);
});

test("reducedSets floors at 1", () => {
  assert.equal(reducedSets(5), 4);
  assert.equal(reducedSets(1), 1);
  assert.equal(reducedSets(2), 2);
});

test("weight trend and calorie advice", () => {
  const hist = Array.from({ length: 14 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    kg: 80 - i * 0.05,
  }));
  const t = weightTrend(hist, "2026-09-14");
  assert.equal(t.status, "ok");
  if (t.status === "ok") {
    const advice = calorieAdvice(t, "recomp", 0.9);
    assert.equal(advice.status, "adjust");
    if (advice.status === "adjust") {
      assert.ok(advice.kcalPerDay > 0);
      assert.ok(advice.kcalPerDay <= 300);
    }
  }
  const hold = calorieAdvice(t as WeightTrend, "recomp", 0.5);
  assert.equal(hold.status, "hold");
});

test("readiness maps optional DayCheck-like recovery fields", () => {
  const hist: ReadinessDay[] = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    sleepHours: 7.5,
    fatigue: 2,
    soreness: 2,
    pain: 0,
  }));
  const day = {
    date: "2026-09-10",
    sleepHours: 5,
    fatigue: 4,
    soreness: 2,
    pain: 0,
  };
  const decision = readiness(day, hist);
  assert.equal(decision.status, "reduce");
});
