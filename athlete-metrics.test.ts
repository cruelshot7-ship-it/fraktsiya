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

const fine: ReadinessDay = { sleepHours: 7.5, fatigue: 2, soreness: 2, pain: 0 };
const week: ReadinessDay[] = Array.from({ length: 14 }, () => ({ ...fine }));

test("readiness: baseline 7.5 h / fatigue 2 -> two deviations means reduce", () => {
  const r = readiness({ sleepHours: 5.5, fatigue: 3.5, soreness: 2, pain: 0 }, week);
  assert.equal(r.verdict, "reduce");
  assert.deepEqual(r.flags, ["сон", "усталость"]);
  assert.equal(r.usedBaseline, true);
});

test("readiness: boundary 7.5 - 1.5 = 6.0 h counts, one flag is watch, none is ok", () => {
  assert.equal(readiness({ ...fine, sleepHours: 6.0 }, week).verdict, "watch");
  assert.equal(readiness({ ...fine, sleepHours: 6.1 }, week).verdict, "ok");
  assert.equal(readiness(fine, week).verdict, "ok");
});

test("readiness: pain overrides everything", () => {
  assert.equal(readiness({ ...fine, pain: 2 }, week).verdict, "modify");
  assert.equal(readiness({ ...fine, pain: 3 }, week).verdict, "skip");
});

test("readiness: under 5 baseline days falls back to absolute thresholds", () => {
  const r = readiness({ sleepHours: 5.9, fatigue: 4, soreness: 2, pain: 0 }, week.slice(0, 3));
  assert.equal(r.usedBaseline, false);
  assert.equal(r.verdict, "reduce");
});

test("reduced sets: -20% rounded, never below 1", () => {
  assert.deepEqual([5, 4, 3, 2, 1].map(reducedSets), [4, 3, 2, 2, 1]);
});

function dailyWeights(): { date: string; kg: number }[] {
  return Array.from({ length: 14 }, (_, i) => ({
    date: `2026-10-${String(1 + i).padStart(2, "0")}`,
    kg: Math.round((80 - 0.1 * i) * 10) / 10,
  }));
}

test("weight trend: -0.1 kg/day from 80 kg is -0.7 kg/week, mean of last 7 days 79.0, -0.89 %/week", () => {
  const t = weightTrend(dailyWeights(), "2026-10-14");
  assert.equal(t.status, "ok");
  if (t.status === "ok") {
    assert.equal(t.kgPerWeek, -0.7);
    assert.equal(t.mean7, 79);
    assert.equal(t.pctPerWeek, -0.89);
    assert.equal(t.points, 14);
  }
});

test("weight trend needs 5 points, 10 days of span and 3 points in the last week", () => {
  assert.equal(weightTrend(dailyWeights().slice(0, 4), "2026-10-14").status, "insufficient");
  const early = dailyWeights().slice(0, 7); // 10-01..10-07, nothing in the last 7 days
  assert.equal(weightTrend(early, "2026-10-14").status, "insufficient");
});

test("calories: fast loss in recomp is capped at +300", () => {
  const a = calorieAdvice({ goal: "recomp", trend: weightTrend(dailyWeights(), "2026-10-14"), adherencePct: 90 });
  assert.deepEqual(a.action === "adjust" ? a.kcalPerDay : null, 300);
});

test("calories: exact formula, (-0.2 - -0.4) * 7700 / 7 = 220 -> 225", () => {
  const trend: WeightTrend = { status: "ok", mean7: 80, kgPerWeek: -0.4, pctPerWeek: -0.5, points: 10 };
  const a = calorieAdvice({ goal: "recomp", trend, adherencePct: 100 });
  assert.equal(a.action === "adjust" ? a.kcalPerDay : null, 225);
});

test("calories: gaining too fast cuts calories, (0.28 - 0.4) * 1100 = -132 -> -125", () => {
  const trend: WeightTrend = { status: "ok", mean7: 80, kgPerWeek: 0.4, pctPerWeek: 0.5, points: 10 };
  const a = calorieAdvice({ goal: "gain", trend, adherencePct: 100 });
  assert.equal(a.action === "adjust" ? a.kcalPerDay : null, -125);
});

test("calories: in band, low adherence or thin data means hold", () => {
  const inBand: WeightTrend = { status: "ok", mean7: 80, kgPerWeek: 0.1, pctPerWeek: 0.13, points: 10 };
  assert.equal(calorieAdvice({ goal: "recomp", trend: inBand, adherencePct: 100 }).action, "hold");
  const out: WeightTrend = { status: "ok", mean7: 80, kgPerWeek: -0.7, pctPerWeek: -0.88, points: 10 };
  assert.equal(calorieAdvice({ goal: "recomp", trend: out, adherencePct: 70 }).action, "hold");
  assert.equal(
    calorieAdvice({ goal: "cut", trend: { status: "insufficient", reason: "x" }, adherencePct: 100 }).action,
    "hold",
  );
});
