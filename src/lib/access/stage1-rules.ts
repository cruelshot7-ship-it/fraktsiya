/**
 * Stage-1 access and lifecycle rules (pure).
 * Server handlers must call the same predicates before mutating state.
 */

export type Role = "client" | "trainer" | "admin";

/** Only the owning coach (or admin) may accept/reject a progression suggestion. */
export function canDecideProgression(
  role: Role,
  actorCoachId: string | null | undefined,
  suggestionCoachId: string,
): boolean {
  if (role === "admin") return true;
  if (role !== "trainer") return false;
  if (!actorCoachId) return false;
  return actorCoachId === suggestionCoachId;
}

/**
 * Подбор прогрессии: главный тренер — по любому тренеру; добавленный тренер — только
 * по себе и только с действующим доступом (пробный или оплаченный). Клиент не может.
 */
export function canSuggestProgression(opts: {
  isMainTrainer: boolean;
  actorId: string;
  requestedCoachId: string;
  coachActive: boolean;
}): boolean {
  if (opts.isMainTrainer) return true;
  return opts.actorId === opts.requestedCoachId && opts.coachActive;
}
