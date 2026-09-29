/**
 * Transparent progression suggestions for strength work.
 * Not medical advice. Trainer must approve every change.
 *
 * Rule: double progression on a single lift —
 * if the client hits the top of the rep range for all working sets
 * at the prescribed load for N consecutive logged sessions, propose +load step.
 * If data is insufficient → status "insufficient_data", never invent load.
 */

export type LiftSetResult = {
  exercise: string;
  load: number;
  unit: "kg" | "lb" | "bw";
  reps: number;
  targetRepsMin: number;
  targetRepsMax: number;
  setsCompleted: number;
  setsPlanned: number;
};

export type SessionResultInput = {
  id: string;
  recordedAt: string;
  sets: LiftSetResult[];
  rpe?: number | null;
};

export type ProgressionConfig = {
  consecutiveHitsRequired: number;
  loadStepKg: number;
  loadStepLb: number;
  minSessions: number;
};

export const DEFAULT_PROGRESSION_CONFIG: ProgressionConfig = {
  consecutiveHitsRequired: 2,
  loadStepKg: 2.5,
  loadStepLb: 5,
  minSessions: 2,
};

export type ProposedExerciseChange = {
  exercise: string;
  fromLoad: number;
  toLoad: number;
  unit: "kg" | "lb" | "bw";
  reason: string;
};

export type ProgressionSuggestion = {
  status: "pending" | "insufficient_data";
  explanation: string;
  basedOnResultIds: string[];
  proposedChanges: ProposedExerciseChange[];
};

function hitTopOfRange(set: LiftSetResult): boolean {
  if (set.setsCompleted < set.setsPlanned) return false;
  if (set.targetRepsMax <= 0) return false;
  return set.reps >= set.targetRepsMax;
}

function loadStep(unit: LiftSetResult["unit"], cfg: ProgressionConfig): number {
  if (unit === "bw") return 0;
  if (unit === "lb") return cfg.loadStepLb;
  return cfg.loadStepKg;
}

/**
 * Build an explainable suggestion from chronological session results
 * (oldest → newest). Only looks at the last `consecutiveHitsRequired`
 * results that contain each exercise.
 */
export function suggestProgression(
  results: SessionResultInput[],
  cfg: ProgressionConfig = DEFAULT_PROGRESSION_CONFIG,
): ProgressionSuggestion {
  if (!results.length || results.length < cfg.minSessions) {
    return {
      status: "insufficient_data",
      explanation:
        "Недостаточно данных: нужно минимум " +
        String(cfg.minSessions) +
        " зафиксированных занятий с результатами.",
      basedOnResultIds: results.map((r) => r.id),
      proposedChanges: [],
    };
  }

  const ordered = [...results].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  );
  const basedOn = ordered.slice(-cfg.consecutiveHitsRequired).map((r) => r.id);

  const latest = ordered[ordered.length - 1];
  const exerciseNames = [
    ...new Set(latest.sets.map((s) => s.exercise.trim()).filter(Boolean)),
  ];

  if (!exerciseNames.length) {
    return {
      status: "insufficient_data",
      explanation: "В последнем результате нет упражнений с нагрузкой.",
      basedOnResultIds: basedOn,
      proposedChanges: [],
    };
  }

  const window = ordered.slice(-cfg.consecutiveHitsRequired);
  const proposedChanges: ProposedExerciseChange[] = [];
  const reasons: string[] = [];

  for (const name of exerciseNames) {
    const perSession = window.map((session) => {
      const sets = session.sets.filter((s) => s.exercise.trim() === name);
      if (!sets.length) return null;
      const main = sets.reduce((a, b) => (b.load >= a.load ? b : a));
      return { sessionId: session.id, main };
    });

    if (perSession.some((x) => x === null)) {
      reasons.push(`${name}: нет данных во всех ${cfg.consecutiveHitsRequired} занятиях.`);
      continue;
    }

    const rows = perSession as { sessionId: string; main: LiftSetResult }[];
    const allHit = rows.every((r) => hitTopOfRange(r.main));
    if (!allHit) {
      reasons.push(
        `${name}: верх диапазона повторений (${rows[0].main.targetRepsMax}) не закрыт во всех последних ${cfg.consecutiveHitsRequired} занятиях.`,
      );
      continue;
    }

    const last = rows[rows.length - 1].main;
    if (last.unit === "bw") {
      reasons.push(`${name}: нагрузка «вес тела» — шаг не предлагается автоматически.`);
      continue;
    }

    const step = loadStep(last.unit, cfg);
    if (step <= 0) {
      reasons.push(`${name}: шаг нагрузки не задан.`);
      continue;
    }

    const toLoad = Math.round((last.load + step) * 100) / 100;
    proposedChanges.push({
      exercise: name,
      fromLoad: last.load,
      toLoad,
      unit: last.unit,
      reason: `Закрыт верх диапазона ${last.targetRepsMin}–${last.targetRepsMax} повторений на ${last.load} ${last.unit} в ${cfg.consecutiveHitsRequired} занятиях подряд.`,
    });
  }

  if (!proposedChanges.length) {
    return {
      status: "insufficient_data",
      explanation:
        reasons.length > 0
          ? reasons.join(" ")
          : "Условий для увеличения нагрузки нет. Оставьте план без изменений или скорректируйте вручную.",
      basedOnResultIds: basedOn,
      proposedChanges: [],
    };
  }

  const explanation =
    "Предложение основано на фактических результатах занятий " +
    basedOn.join(", ") +
    ". " +
    proposedChanges.map((c) => c.reason).join(" ");

  return {
    status: "pending",
    explanation,
    basedOnResultIds: basedOn,
    proposedChanges,
  };
}
