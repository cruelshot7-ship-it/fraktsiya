/**
 * Privacy consent and erasure rules. Pure functions, no imports.
 * The version is bumped whenever the policy text changes; every client
 * must accept the current version before their data is used.
 */

// Bump on every change of the policy text: consent given to an older text does not cover the new one.
export const PRIVACY_VERSION = "2026-10-10.2";

/** declinedAt is set only while the client has refused the current version; an acceptance clears it. */
export type Consent = { version: string; acceptedAt: string | null; declinedAt?: string | null };

/** Append-only evidence trail. Times are server time. Never edited or trimmed. */
export type ConsentEvent = { version: string; at: string; action: "accept" | "decline" | "erase" };

export function appendConsentLog(log: ConsentEvent[] | undefined, event: ConsentEvent): ConsentEvent[] {
  return [...(log ?? []), event];
}

/** Trainer notice for an erasure. Carries no name: the client is already anonymized. */
export function erasureNotice(clientId: string, at: string) {
  return {
    id: `nt_erase_${clientId}_${at}`,
    audience: "trainer" as const,
    clientId,
    kind: "alert" as const,
    title: "Клиент удалил свои данные",
    body: "Личные данные скрыты, замеры и тренировки удалены. Записи и история баланса сохранены для учёта.",
    at,
  };
}

/** True when the client has not accepted the current policy version. */
export function needsConsent(consent: Consent | null | undefined): boolean {
  return !consent || consent.version !== PRIVACY_VERSION || !consent.acceptedAt;
}

/** True while the client has neither accepted nor refused the current version. A refusal is a decision too. */
export function needsDecision(consent: Consent | null | undefined): boolean {
  return !consent || consent.version !== PRIVACY_VERSION || (!consent.acceptedAt && !consent.declinedAt);
}

/**
 * Special data (wellbeing, pain, body measures) is taken only with an accepted current version.
 * A refusal does not block the rest: bookings, the program and the balance keep working.
 */
export function specialDataAllowed(consent: Consent | null | undefined): boolean {
  return Boolean(consent && consent.version === PRIVACY_VERSION && consent.acceptedAt);
}

/**
 * Server-side stamp: the server time is the record, the client's clock is not trusted.
 * Only an explicit acceptance (acceptedAt set) grants consent; a refusal is recorded as declinedAt.
 */
export function stampConsent(prev: Consent | null | undefined, next: Consent | null | undefined, now: string): Consent | null {
  if (!next || next.version !== PRIVACY_VERSION) return prev ?? null;
  if (prev && prev.version === PRIVACY_VERSION && prev.acceptedAt) return prev;
  if (next.acceptedAt) return { version: PRIVACY_VERSION, acceptedAt: now };
  if (next.declinedAt) {
    if (prev && prev.version === PRIVACY_VERSION && prev.declinedAt) return prev;
    return { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: now };
  }
  return prev ?? null;
}

/**
 * Logs an acceptance or a refusal only when the server actually stamps a new one.
 * Repeats (the same state sent again) are not logged, so the trail holds one line per decision.
 */
export function consentLogAfter(
  mine: { consent?: Consent | null; consentLog?: ConsentEvent[] },
  next: Consent | null | undefined,
  now: string,
): ConsentEvent[] | undefined {
  const before = mine.consent;
  const stamped = stampConsent(before, next, now);
  if (!stamped) return mine.consentLog;
  if (stamped.acceptedAt && (!before || before.version !== stamped.version || before.acceptedAt !== stamped.acceptedAt)) {
    return appendConsentLog(mine.consentLog, { version: stamped.version, at: stamped.acceptedAt, action: "accept" });
  }
  if (!stamped.acceptedAt && stamped.declinedAt && before?.declinedAt !== stamped.declinedAt) {
    return appendConsentLog(mine.consentLog, { version: stamped.version, at: stamped.declinedAt, action: "decline" });
  }
  return mine.consentLog;
}

/** Identity fields replaced on erasure. Nothing that identifies the person remains. */
export function anonymizedIdentity() {
  return {
    firstName: "Удалён",
    lastName: "",
    telegramId: null,
    telegramUsername: null,
    phone: null,
    healthToken: null,
    coachId: null,
  };
}
