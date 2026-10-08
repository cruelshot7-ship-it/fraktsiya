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

// ---------- 2. PR detection ----------

export type PersonalRecord = {
  date: string;
  exercise: string;
  e1rm: number;
  previous: number;
  gain: number;
};

/** Sets must be in chronological order. The first reliable set of an exercise is a baseline, not a PR. */
export function detectPRs(sets: SetEntry[]): PersonalRecord[] {
  const best = new Map<string, number>();
  const out: PersonalRecord[] = [];
  for (const s of sets) {
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
  | { status: "ok"; kgPerWeek: number; sessions: number; spanDays: number; latest: number }
  | { status: "insufficient"; reason: string };

export function e1rmTrend(sets: SetEntry[], exercise: string, lastSessions = 6): E1rmTrend {
  const bestByDay = new Map<string, number>();
  for (const s of sets) {
    if (s.exercise !== exercise || !isReliable(s.reps, s.rir)) continue;
    const v = e1rm(s.weight, s.reps, s.rir);
    if (v > (bestByDay.get(s.date) ?? 0)) bestByDay.set(s.date, v);
  }
  const days = [...bestByDay.keys()].sort().slice(-lastSessions);
  if (days.length < 3) return { status: "insufficient", reason: "Нужно минимум 3 тренировки с этим упражнением." };
  const x0 = dayNumber(days[0]);
  const span = dayNumber(days[days.length - 1]) - x0;
  if (span < 14) return { status: "insufficient", reason: "Нужен период минимум 14 дней." };
  const pts = days.map((d) => ({ x: dayNumber(d) - x0, y: bestByDay.get(d)! }));
  const k = slope(pts)!;
  return {
    status: "ok",
    kgPerWeek: r2(k * 7),
    sessions: days.length,
    spanDays: span,
    latest: pts[pts.length - 1].y,
  };
}

// ---------- 4. Readiness ----------

export type ReadinessDay = {
  sleepHours: number;
  fatigue: number; // 1 (fresh) .. 5 (wrecked)
  soreness: number; // 1 .. 5
  pain: number; // 0 none, 1 mild, 2 moderate, 3 severe
};

export type ReadinessVerdict = "ok" | "watch" | "reduce" | "modify" | "skip";

export type Readiness = {
  verdict: ReadinessVerdict;
  flags: string[];
  usedBaseline: boolean;
  advice: string;
};

export const BASELINE_MIN_DAYS = 5;

export function readiness(today: ReadinessDay, history: ReadinessDay[]): Readiness {
  const base = history.slice(-14);
  const usedBaseline = base.length >= BASELINE_MIN_DAYS;
  const baseSleep = usedBaseline ? mean(base.map((d) => d.sleepHours)) : null;
  const baseFatigue = usedBaseline ? mean(base.map((d) => d.fatigue)) : null;

  const flags: string[] = [];
  if (baseSleep !== null ? today.sleepHours <= baseSleep - 1.5 : today.sleepHours < 6) flags.push("сон");
  if (baseFatigue !== null ? today.fatigue >= baseFatigue + 1 : today.fatigue >= 4) flags.push("усталость");
  if (today.soreness >= 4) flags.push("крепатура");

  let verdict: ReadinessVerdict;
  if (today.pain >= 3) verdict = "skip";
  else if (today.pain === 2) verdict = "modify";
  else if (flags.length >= 2) verdict = "reduce";
  else if (flags.length === 1) verdict = "watch";
  else verdict = "ok";

  const advice: Record<ReadinessVerdict, string> = {
    ok: "Работать по плану.",
    watch: "По плану, следить за техникой и RIR.",
    reduce: "Объём минус 20%: подходов в каждом упражнении n -> max(1, round(n * 0.8)), веса те же.",
    modify: "Исключить нагрузку на болевую зону, заменить упражнения. Если боль держится, обратиться к врачу.",
    skip: "Тренировку не проводить. Сильная боль: консультация врача.",
  };
  return { verdict, flags, usedBaseline, advice: advice[verdict] };
}

export function reducedSets(planned: number): number {
  return Math.max(1, Math.round(planned * 0.8));
}

// ---------- 5. Weight trend ----------

export type WeightPoint = { date: string; kg: number };

export type WeightTrend =
  | { status: "ok"; mean7: number; kgPerWeek: number; pctPerWeek: number; points: number }
  | { status: "insufficient"; reason: string };

export function weightTrend(points: WeightPoint[], today: string): WeightTrend {
  const t = dayNumber(today);
  const win = points.filter((p) => {
    const d = dayNumber(p.date);
    return d <= t && d > t - 14 && p.kg > 0;
  });
  if (win.length < 5) return { status: "insufficient", reason: "Нужно минимум 5 взвешиваний за 14 дней." };
  const days = win.map((p) => dayNumber(p.date));
  if (Math.max(...days) - Math.min(...days) < 10) {
    return { status: "insufficient", reason: "Взвешивания должны покрывать минимум 10 дней." };
  }
  const last7 = win.filter((p) => dayNumber(p.date) > t - 7);
  if (last7.length < 3) return { status: "insufficient", reason: "Нужно минимум 3 взвешивания за последние 7 дней." };
  const mean7 = mean(last7.map((p) => p.kg));
  const k = slope(win.map((p) => ({ x: dayNumber(p.date), y: p.kg })))!;
  const kgPerWeek = k * 7;
  return {
    status: "ok",
    mean7: r1(mean7),
    kgPerWeek: r2(kgPerWeek),
    pctPerWeek: r2((kgPerWeek / mean7) * 100),
    points: win.length,
  };
}

// ---------- 6. Calorie correction ----------

export type BodyGoal = "cut" | "recomp" | "gain";

/** Target weekly change, percent of bodyweight. */
export const RATE_BANDS: Record<BodyGoal, { min: number; max: number }> = {
  cut: { min: -0.75, max: -0.25 },
  recomp: { min: -0.25, max: 0.25 },
  gain: { min: 0.1, max: 0.35 },
};

export const MAX_KCAL_STEP = 300;
export const MIN_ADHERENCE = 80;

export type CalorieAdvice =
  | { action: "hold"; reason: string }
  | { action: "adjust"; kcalPerDay: number; reason: string };

const round25 = (n: number) => {
  const v = Math.round(n / 25) * 25;
  return v === 0 ? 0 : v;
};

export function calorieAdvice(input: {
  goal: BodyGoal;
  trend: WeightTrend;
  adherencePct: number; // share of days in the window with logged food, 0..100
}): CalorieAdvice {
  const { goal, trend, adherencePct } = input;
  if (trend.status !== "ok") return { action: "hold", reason: trend.reason };
  if (adherencePct < MIN_ADHERENCE) {
    return { action: "hold", reason: `Питание внесено меньше чем за ${MIN_ADHERENCE}% дней. Данных мало, калории не менять.` };
  }
  const band = RATE_BANDS[goal];
  const pct = trend.pctPerWeek;
  if (pct >= band.min && pct <= band.max) {
    return { action: "hold", reason: "Темп в целевом коридоре. Калории не менять." };
  }
  const edge = pct < band.min ? band.min : band.max;
  const targetKgPerWeek = (edge / 100) * trend.mean7;
  const raw = ((targetKgPerWeek - trend.kgPerWeek) * KCAL_PER_KG) / 7;
  const kcal = round25(Math.max(-MAX_KCAL_STEP, Math.min(MAX_KCAL_STEP, raw)));
  if (kcal === 0) return { action: "hold", reason: "Отклонение меньше шага в 25 ккал." };
  return {
    action: "adjust",
    kcalPerDay: kcal,
    reason: `Темп ${trend.pctPerWeek}% в неделю, цель до ${edge}%. Проверить через 14 дней.`,
  };
}
