/**
 * Боль блокирует автоматическое повышение нагрузки. Источник — чек-ин дня (pain 0–3).
 * Правило: боль больше нуля в любой из последних 7 дней, включая сегодня. Чистая логика.
 */
import { daysUntil } from "@/lib/balance-summary";
import type { ProgressionSuggestion } from "./engine";

export const PAIN_BLOCK_DAYS = 7;

export function painBlocksProgression(checks: { date: string; pain?: number }[], today: string): boolean {
  return checks.some((c) => {
    if ((c.pain ?? 0) <= 0) return false;
    const d = daysUntil(c.date, today);
    return d <= 0 && d > -PAIN_BLOCK_DAYS;
  });
}

/** Убирает повышения нагрузки из предложения, если боль блокирует. Снижения и прочее остаются. */
export function applyPainBlock(s: ProgressionSuggestion, blocked: boolean): ProgressionSuggestion {
  if (!blocked) return s;
  const increases = s.proposedChanges.filter((c) => c.toLoad > c.fromLoad);
  if (!increases.length) return s;
  const kept = s.proposedChanges.filter((c) => c.toLoad <= c.fromLoad);
  return {
    ...s,
    proposedChanges: kept,
    explanation: `${s.explanation} Повышение нагрузки не предлагаем: в чек-ине за ${PAIN_BLOCK_DAYS} дн. отмечена боль. Сначала проверьте самочувствие клиента.`,
  };
}
