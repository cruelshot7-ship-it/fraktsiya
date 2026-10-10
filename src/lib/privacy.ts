/**
 * Privacy consent and erasure rules. Pure functions, no imports.
 * The version is bumped whenever the policy text changes; every client
 * must accept the current version before their data is used.
 */

export const PRIVACY_VERSION = "2026-10-10";

export type Consent = { version: string; acceptedAt: string | null };

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
