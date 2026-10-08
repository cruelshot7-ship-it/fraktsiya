/**
 * Athlete metrics. Pure functions, no I/O, no imports.
 * Every number here is a documented formula. Not medical advice.
 *
 * 1. e1RM        = weight * (1 + (reps + RIR) / 30)          (Epley on reps-to-failure)
 * 2. PR          = new best e1RM over all earlier reliable sets of the exercise
 * 3. e1RM trend  = least-squares slope over the last sessions, kg per week
 * 4. Readiness   = personal-baseline flags -> ok / watch / reduce / modify / skip
 * 5. Weight trend = 14-day least-squares slope, as % of 7-day mean bodyweight per week
 * 6. Calories    = (target rate - actual rate) * 7700 / 7 per day, capped, only on full data
 */

export type SetEntry = {
  date: string; // YYYY-MM-DD
  exercise: string;
  weight: number; // kg
  reps: number;
  rir?: number | null; // reps in reserve; missing is treated as 0 (conservative)
};

export const KCAL_PER_KG = 7700;
export const RELIABLE_MAX_RTF = 10; // Epley is not trusted above 10 reps to failure
const PR_EPSILON = 0.05;

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 86_400_000);
}

/** Ordinary least squares slope of y over x. Needs at least 2 distinct x. */
export function slope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

// ---------- 1. e1RM ----------

export function repsToFailure(reps: number, rir?: number | null) {
  const safeRir = typeof rir === "number" && Number.isFinite(rir) && rir > 0 ? rir : 0;
  return reps + safeRir;
}

export function e1rm(weight: number, reps: number, rir?: number | null): number {
  if (!(weight > 0) || !(reps > 0)) return 0;
  const rtf = repsToFailure(reps, rir);
  if (rtf <= 1) return r1(weight);
  return r1(weight * (1 + rtf / 30));
}

export function isReliable(reps: number, rir?: number | null): boolean {
  return reps > 0 && repsToFailure(reps, rir) <= RELIABLE_MAX_RTF;
}

// ---------- 2. PR ----------

export type PersonalRecord = {
  date: string;
  exercise: string;
  e1rm: number;
  previous: number;
  gain: number;
};

/** Chronological sets. First reliable set of an exercise is baseline, not a PR. */
export function detectPRs(sets: SetEntry[]): PersonalRecord[] {
  const ordered = [...sets].sort((a, b) => a.date.localeCompare(b.date));
  const best = new Map<string, number>();
  const out: PersonalRecord[] = [];
  for (const s of ordered) {
    if (!isReliable(s.reps, s.rir)) continue;
    const value = e1rm(s.weight, s.reps, s.rir);
    if (!(value > 0)) continue;
    const prev = best.get(s.exercise);
    if (prev === undefined) {
      best.set(s.exercise, value);
      continue;
    }
    if (value > prev + PR_EPSILON) {
      out.push({ date: s.date, exercise: s.exercise, e1rm: value, previous: prev, gain: r1(value - prev) });
      best.set(s.exercise, value);
    }
  }
  return out;
}

// ---------- 3. e1RM trend ----------

export type E1rmTrend =
  | { status: "insufficient"; reason: string }
  | { status: "ok"; kgPerWeek: number; sessions: number; spanDays: number; latest: number };

/** Best reliable set per session day, last 6 sessions, min 3 sessions and 14 days span. */
export function e1rmTrend(sets: SetEntry[], exercise: string): E1rmTrend {
  const byDay = new Map<string, number>();
  for (const s of sets) {
    if (s.exercise !== exercise || !isReliable(s.reps, s.rir)) continue;
    const v = e1rm(s.weight, s.reps, s.rir);
    if (!(v > 0)) continue;
    const prev = byDay.get(s.date);
    if (prev === undefined || v > prev) byDay.set(s.date, v);
  }
  const days = [...byDay.keys()].sort();
  const last = days.slice(-6);
  if (last.length < 3) return { status: "insufficient", reason: "need at least 3 sessions" };
  const spanDays = dayNumber(last[last.length - 1]) - dayNumber(last[0]);
  if (spanDays < 14) return { status: "insufficient", reason: "need at least 14 days span" };
  const points = last.map((d) => ({ x: dayNumber(d) / 7, y: byDay.get(d)! }));
  const s = slope(points);
  if (s === null) return { status: "insufficient", reason: "cannot fit slope" };
  return {
    status: "ok",
    kgPerWeek: r1(s),
    sessions: last.length,
    spanDays,
    latest: byDay.get(last[last.length - 1])!,
  };
}

// ---------- 4. Readiness ----------

export type ReadinessDay = {
  date: string;
  sleepHours: number;
  fatigue: number; // 1-5
  soreness: number; // 1-5
  pain: number; // 0-3
};

export type ReadinessDecision =
  | { status: "skip"; reason: string }
  | { status: "modify"; reason: string }
  | { status: "reduce"; reason: string; setFactor: number }
  | { status: "watch"; reason: string }
  | { status: "ok"; reason: string };

export function readinessBaseline(history: ReadinessDay[]): { sleep: number; fatigue: number } | null {
  if (history.length < 5) return null;
  const recent = [...history].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  if (recent.length < 5) return null;
  return {
    sleep: mean(recent.map((d) => d.sleepHours)),
    fatigue: mean(recent.map((d) => d.fatigue)),
  };
}

export function readiness(today: ReadinessDay, history: ReadinessDay[]): ReadinessDecision {
  if (today.pain >= 3) return { status: "skip", reason: "pain 3 — do not train" };
  if (today.pain >= 2) return { status: "modify", reason: "pain 2 — replace exercises" };

  const base = readinessBaseline(history);
  let flags = 0;
  const notes: string[] = [];

  if (base) {
    if (today.sleepHours <= base.sleep - 1.5) {
      flags += 1;
      notes.push("sleep low vs baseline");
    }
    if (today.fatigue >= base.fatigue + 1) {
      flags += 1;
      notes.push("fatigue high vs baseline");
    }
  } else {
    if (today.sleepHours < 6) {
      flags += 1;
      notes.push("sleep < 6h");
    }
    if (today.fatigue >= 4) {
      flags += 1;
      notes.push("fatigue ≥ 4");
    }
  }
  if (today.soreness >= 4) {
    flags += 1;
    notes.push("soreness ≥ 4");
  }

  if (flags >= 2) return { status: "reduce", reason: notes.join("; "), setFactor: 0.8 };
  if (flags === 1) return { status: "watch", reason: notes.join("; ") };
  return { status: "ok", reason: "on plan" };
}

/** Reduce sets: max(1, round(n * 0.8)), weight unchanged. */
export function reducedSets(n: number, factor = 0.8): number {
  return Math.max(1, Math.round(n * factor));
}

// ---------- 5. Weight trend ----------

export type WeightPoint = { date: string; kg: number };

export type WeightTrend =
  | { status: "insufficient"; reason: string }
  | { status: "ok"; kgPerWeek: number; pctPerWeek: number; mean7d: number; points: number };

export function weightTrend(history: WeightPoint[], asOf?: string): WeightTrend {
  const ordered = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const end = asOf ?? ordered[ordered.length - 1]?.date;
  if (!end) return { status: "insufficient", reason: "no data" };
  const endDay = dayNumber(end);
  const window = ordered.filter((p) => {
    const d = dayNumber(p.date);
    return d >= endDay - 13 && d <= endDay;
  });
  if (window.length < 5) return { status: "insufficient", reason: "need ≥5 weigh-ins in 14 days" };
  const span = dayNumber(window[window.length - 1].date) - dayNumber(window[0].date);
  if (span < 10) return { status: "insufficient", reason: "need ≥10 day span" };
  const last7 = window.filter((p) => dayNumber(p.date) >= endDay - 6);
  if (last7.length < 3) return { status: "insufficient", reason: "need ≥3 weigh-ins in last 7 days" };

  const points = window.map((p) => ({ x: dayNumber(p.date) / 7, y: p.kg }));
  const s = slope(points);
  if (s === null) return { status: "insufficient", reason: "cannot fit slope" };
  const mean7d = mean(last7.map((p) => p.kg));
  const pct = mean7d > 0 ? (s / mean7d) * 100 : 0;
  return {
    status: "ok",
    kgPerWeek: r2(s),
    pctPerWeek: r3(pct),
    mean7d: r1(mean7d),
    points: window.length,
  };
}

// ---------- 6. Calories ----------

export type GoalCorridor = "cut" | "recomp" | "bulk";

const CORRIDORS: Record<GoalCorridor, { min: number; max: number }> = {
  cut: { min: -0.75, max: -0.25 },
  recomp: { min: -0.25, max: 0.25 },
  bulk: { min: 0.1, max: 0.35 },
};

export type CalorieAdvice =
  | { status: "hold"; reason: string }
  | { status: "adjust"; kcalPerDay: number; reason: string };

/**
 * kcal/day = (boundary rate - actual rate) * 7700 / 7, rounded to 25, capped ±300.
 * Only when food logged ≥80% of days and weight trend is ok.
 */
export function calorieAdvice(
  trend: WeightTrend,
  goal: GoalCorridor,
  foodAdherence: number, // 0..1 fraction of days with food log in window
): CalorieAdvice {
  if (trend.status !== "ok") return { status: "hold", reason: "insufficient weight data" };
  if (!(foodAdherence >= 0.8)) return { status: "hold", reason: "food log < 80% of days" };

  const band = CORRIDORS[goal];
  const rate = trend.kgPerWeek;
  let target = rate;
  if (rate < band.min) target = band.min;
  else if (rate > band.max) target = band.max;
  else return { status: "hold", reason: "inside corridor" };

  let delta = ((target - rate) * KCAL_PER_KG) / 7;
  delta = Math.round(delta / 25) * 25;
  if (delta > 300) delta = 300;
  if (delta < -300) delta = -300;
  if (delta === 0) return { status: "hold", reason: "adjustment rounds to 0" };
  return {
    status: "adjust",
    kcalPerDay: delta,
    reason: `rate ${rate} kg/wk vs ${goal} corridor`,
  };
}
