/**
 * Privacy consent and erasure rules. Pure functions, no imports.
 * The version is bumped whenever the policy text changes; every client
 * must accept the current version before their data is used.
 */

export const PRIVACY_VERSION = "2026-10-10";

export type Consent = { version: string; acceptedAt: string | null };

/** Append-only evidence trail. Times are server time. Never edited or trimmed. */
export type ConsentEvent = { version: string; at: string; action: "accept" | "erase" };

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

/** Server-side stamp: the server time is the record, the client's clock is not trusted. */
export function stampConsent(prev: Consent | null | undefined, next: Consent | null | undefined, now: string): Consent | null {
  if (!next || next.version !== PRIVACY_VERSION) return prev ?? null;
  if (prev && prev.version === PRIVACY_VERSION && prev.acceptedAt) return prev;
  return { version: PRIVACY_VERSION, acceptedAt: now };
}

/** Logs an acceptance only when the server actually stamps a new one; repeats are not logged. */
export function consentLogAfter(
  mine: { consent?: Consent | null; consentLog?: ConsentEvent[] },
  next: Consent | null | undefined,
  now: string,
): ConsentEvent[] | undefined {
  const stamped = stampConsent(mine.consent, next, now);
  const changed =
    !!stamped && (!mine.consent || mine.consent.version !== stamped.version || mine.consent.acceptedAt !== stamped.acceptedAt);
  if (!changed || !stamped?.acceptedAt) return mine.consentLog;
  return appendConsentLog(mine.consentLog, { version: stamped.version, at: stamped.acceptedAt, action: "accept" });
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
