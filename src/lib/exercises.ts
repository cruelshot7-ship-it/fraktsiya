/**
 * Exercise names for the personal-record block. Pure, no imports.
 *
 * Stage 1: a lift is identified by its normalized name, so the log stays compatible
 * with records written before this module existed. Stage 2 moves blocks to ids.
 */
export const SEED_EXERCISES = ["жим", "присед", "тяга", "подтягивания", "армейский"] as const;

export const EXERCISE_NAME_MAX = 40;
export const CUSTOM_EXERCISE_MAX = 30;

/** Comparison key: case, ё/е and extra spaces do not make a different exercise. */
export function exerciseKey(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

export function sameExercise(a: string, b: string): boolean {
  return exerciseKey(a) === exerciseKey(b);
}

/**
 * Options for the record chips: base exercises, then the trainer's custom ones,
 * then anything the client has logged. Each key appears once, in first-seen order.
 */
export function exerciseOptions(input: { custom?: string[]; historyNames?: string[] }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...SEED_EXERCISES, ...(input.custom ?? []), ...(input.historyNames ?? [])]) {
    const key = exerciseKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export type AddExerciseResult = { ok: true; list: string[] } | { ok: false; reason: string };

/** Adds a custom exercise. Refuses empty, too long, duplicate (after normalization) or over the cap. */
export function addExerciseName(list: string[], raw: string): AddExerciseResult {
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, reason: "Введите название упражнения." };
  if (name.length > EXERCISE_NAME_MAX) return { ok: false, reason: `Не длиннее ${EXERCISE_NAME_MAX} знаков.` };
  if (exerciseOptions({ custom: list, historyNames: [] }).includes(exerciseKey(name))) {
    return { ok: false, reason: "Такое упражнение уже есть." };
  }
  if (list.length >= CUSTOM_EXERCISE_MAX) return { ok: false, reason: `Не больше ${CUSTOM_EXERCISE_MAX} своих упражнений.` };
  return { ok: true, list: [...list, exerciseKey(name)] };
}
