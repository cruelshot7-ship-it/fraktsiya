/** Program templates: assign creates a client-owned copy. */

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
