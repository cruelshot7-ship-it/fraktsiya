/**
 * Подписка тренера по ступеням: цена зависит от числа клиентов в его карточках.
 * Чистый модуль без импортов: используется клиентом, сервером и тестами.
 */
export const COACH_TIERS = [
  { upTo: 10, usd: 10 },
  { upTo: 20, usd: 15 },
  { upTo: Number.POSITIVE_INFINITY, usd: 20 },
] as const;

/** Для текстов в интерфейсе: «до 10 клиентов — $10, 11–20 — $15, от 21 — $20 в месяц». */
export const COACH_TIERS_TEXT =
  `до ${COACH_TIERS[0].upTo} клиентов — $${COACH_TIERS[0].usd}, ` +
  `${COACH_TIERS[0].upTo + 1}–${COACH_TIERS[1].upTo} — $${COACH_TIERS[1].usd}, ` +
  `от ${COACH_TIERS[1].upTo + 1} — $${COACH_TIERS[2].usd} в месяц`;

function count(n: number) {
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}

export function coachTierUsd(clientCount: number): number {
  const n = count(clientCount);
  return (COACH_TIERS.find((t) => n <= t.upTo) ?? COACH_TIERS[COACH_TIERS.length - 1]).usd;
}

/** 1 клиент, 2 клиента, 5 клиентов, 21 клиент, 12 клиентов. */
export function clientsWord(n: number): string {
  const k = count(n);
  const last = k % 10;
  const tens = k % 100;
  if (last === 1 && tens !== 11) return "клиент";
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return "клиента";
  return "клиентов";
}

/** «12 клиентов · $15 в месяц» */
export function coachTierLine(clientCount: number): string {
  const n = count(clientCount);
  return `${n} ${clientsWord(n)} · $${coachTierUsd(n)} в месяц`;
}
