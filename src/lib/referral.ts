/**
 * Приглашение клиентом. Код выдаёт сервер (ссылка r_<код>). Награда — одно занятие пригласившему,
 * когда тренер отметит первый пакет приглашённого оплаченным. Событие награды имеет стабильный id,
 * поэтому повторная отметка не начисляет дважды. Чистая логика, без I/O.
 */
import type { Client, SessionTxn } from "@/data/studio";

export const REFERRAL_REWARD = 1;
export const REFERRAL_NOTE = "Бонус: приглашённый клиент оплатил пакет";

const CODE_RE = /^[a-f0-9]{12}$/;

export function newReferralCode(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

export function isReferralCode(code: string | null | undefined): code is string {
  return CODE_RE.test((code ?? "").toLowerCase());
}

export function referralStart(code: string): string {
  return `r_${code}`;
}

/** Код из стартового параметра r_<код>; null, если параметр не реферальный. */
export function referralCodeFromStart(start: string): string | null {
  const m = /^r_([a-f0-9]{12})$/i.exec((start ?? "").trim());
  return m ? m[1].toLowerCase() : null;
}

export function referrerByCode(code: string, clients: Client[]): Client | undefined {
  if (!isReferralCode(code)) return undefined;
  return clients.find((c) => (c.referralCode ?? "").toLowerCase() === code);
}

export function referralRewardTxn(referrerId: string, referredId: string, at: string): SessionTxn {
  return {
    id: `ref_${referredId}`,
    clientId: referrerId,
    kind: "credit",
    delta: REFERRAL_REWARD,
    at,
    note: REFERRAL_NOTE,
  };
}

/** Награда за этого приглашённого уже учтена: есть в журнале или среди применённых событий. */
export function referralRewarded(referredId: string, referrer: Client): boolean {
  const id = `ref_${referredId}`;
  return (referrer.ledger ?? []).some((t) => t.id === id) || (referrer.txnIds ?? []).includes(id);
}
