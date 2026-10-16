/**
 * Токен тренера из start-параметра Mini App.
 * `c_<код|id>` — ссылка клиента; `coach_<код|id>` — ссылка тренера с QR. Иначе null (главный тренер).
 */
export function coachTokenFromStart(start: string): string | null {
  const match = /^(?:c|coach)_([a-z0-9]+)$/i.exec((start ?? "").trim());
  return match ? match[1] : null;
}
