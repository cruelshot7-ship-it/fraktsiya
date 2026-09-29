/**
 * Stage-1 access and lifecycle rules (pure).
 * Server handlers must call the same predicates before mutating state.
 */

export type Role = "client" | "trainer" | "admin";

/** Trainer may only mutate slots they own. Admin may anything. */
export function canManageSlot(
  role: Role,
  actorCoachId: string | null | undefined,
  slotOwnerCoachId: string,
): boolean {
  if (role === "admin") return true;
  if (role !== "trainer") return false;
  if (!actorCoachId) return false;
  return actorCoachId === slotOwnerCoachId;
}

/** Trainer may only see/edit linked clients (same coach id). */
export function canAccessClient(
  role: Role,
  actorId: string,
  clientOwnerCoachId: string | null | undefined,
  clientUserId: string,
): boolean {
  if (role === "admin") return true;
  if (role === "client") return actorId === clientUserId;
  if (role === "trainer") {
    if (!clientOwnerCoachId) return false;
    return actorId === clientOwnerCoachId;
  }
  return false;
}

/**
 * Session results require confirmed attendance.
 * Time elapsed alone is not attendance.
 */
export function canRecordSessionResult(opts: {
  attendanceConfirmed: boolean;
  alreadyRecordedForExercise: boolean;
}): { ok: true } | { ok: false; reason: "no_attendance" | "duplicate_exercise" } {
  if (!opts.attendanceConfirmed) return { ok: false, reason: "no_attendance" };
  if (opts.alreadyRecordedForExercise) return { ok: false, reason: "duplicate_exercise" };
  return { ok: true };
}

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
 * Discomfort / pain note blocks automatic load increase.
 * Surfaces to trainer; never emits medical advice.
 */
export function progressionBlockedByDiscomfort(clientNote: string | null | undefined): boolean {
  if (!clientNote) return false;
  const t = clientNote.toLowerCase();
  return (
    t.includes("боль") ||
    t.includes("болит") ||
    t.includes("дискомфорт") ||
    t.includes("pain") ||
    t.includes("hurt")
  );
}
