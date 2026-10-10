/** Program templates: assign creates a client-owned copy. */
import type { ProgramBlock } from "@/lib/program-blocks";

export type TemplateExercise = {
  name: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  load?: number;
  unit?: "kg" | "lb" | "bw";
  note?: string;
};

export type ProgramTemplate = {
  id: string;
  coachId: string;
  title: string;
  exercises: TemplateExercise[];
  version: number;
  updatedAt: string;
};

export type ClientProgramCopy = {
  id: string;
  templateId: string;
  templateVersionAtAssign: number;
  coachId: string;
  clientId: string;
  title: string;
  exercises: TemplateExercise[];
  assignedAt: string;
};

export function assignTemplateToClient(
  template: ProgramTemplate,
  clientId: string,
  now = new Date().toISOString(),
): ClientProgramCopy {
  return {
    id: `cp_${template.id}_${clientId}_${template.version}`,
    templateId: template.id,
    templateVersionAtAssign: template.version,
    coachId: template.coachId,
    clientId,
    title: template.title,
    exercises: template.exercises.map((e) => ({ ...e })),
    assignedAt: now,
  };
}

export function bumpTemplate(
  template: ProgramTemplate,
  patch: Partial<Pick<ProgramTemplate, "title" | "exercises">>,
  now = new Date().toISOString(),
): ProgramTemplate {
  return {
    ...template,
    title: patch.title ?? template.title,
    exercises: patch.exercises
      ? patch.exercises.map((e) => ({ ...e }))
      : template.exercises.map((e) => ({ ...e })),
    version: template.version + 1,
    updatedAt: now,
  };
}

/** "8-10" → 8..10, "8" → 8..8. Anything else → 0..0, so the trainer sees it and fixes it. */
export function parseReps(reps: string): { min: number; max: number } {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(reps);
  if (!m) return { min: 0, max: 0 };
  const min = Number(m[1]);
  return { min, max: m[2] ? Number(m[2]) : min };
}

/** "80 кг" or "10-12 кг" → 80 and 10: the first number is the working load. */
export function parseLoad(load: string): number | undefined {
  const m = /(\d+(?:[.,]\d+)?)/.exec(load);
  return m ? Number(m[1].replace(",", ".")) : undefined;
}

export function exerciseFromBlock(b: ProgramBlock): TemplateExercise {
  const reps = parseReps(b.reps ?? "");
  const load = parseLoad(b.load ?? "");
  const rest = b.rest && b.rest > 0 ? `отдых ${b.rest} с` : undefined;
  return {
    name: b.exercise.trim(),
    sets: b.sets,
    repsMin: reps.min,
    repsMax: reps.max,
    ...(load != null ? { load, unit: "kg" as const } : {}),
    ...(rest ? { note: rest } : {}),
  };
}

/** A day of the trainer's program as a template. The caller refuses an empty day. */
export function templateFromSession(
  session: { name: string; blocks?: ProgramBlock[] },
  coachId: string,
  id: string,
  now = new Date().toISOString(),
): ProgramTemplate {
  const exercises = (session.blocks ?? []).filter((b) => b.exercise.trim()).map(exerciseFromBlock);
  return { id, coachId, title: session.name.trim() || "День", exercises, version: 1, updatedAt: now };
}

/**
 * Templates after a trainer's copy is pushed. The trainer's own templates come from that copy,
 * so a delete sticks; other coaches' templates are kept as they are.
 */
export function mergeCoachTemplates(
  current: ProgramTemplate[],
  incoming: ProgramTemplate[],
  mine: string,
  keyOf: (coachId: string) => string,
): ProgramTemplate[] {
  const others = current.filter((t) => keyOf(t.coachId) !== mine);
  const own = incoming.filter((t) => keyOf(t.coachId) === mine).map((t) => ({ ...t, coachId: mine }));
  return [...others, ...own];
}
