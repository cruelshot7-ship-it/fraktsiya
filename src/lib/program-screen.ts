/**
 * Экран программы: серия, недельный счётчик и ближайший визит считаются от визитов, а не от записей.
 * Pure: без импортов, проверяется node --test. Даты — ISO «YYYY-MM-DD», арифметика в UTC (без сдвига пояса).
 *
 * Визит — состоявшееся посещение (отметка «Я на месте» или отметка тренера), см. studio.ts visitDatesOf.
 */

const DAY_MS = 86_400_000;

export function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS).toISOString().slice(0, 10);
}

/** Понедельник недели, в которой лежит дата. */
export function weekStartIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return addDaysIso(iso, -dow);
}

/**
 * Серия: подряд идущие тренировочные дни с визитом.
 * Дни отдыха не ломают серию и не добавляют к ней. Сегодняшний тренировочный день без визита
 * серию ещё не ломает: день может быть впереди. Пропущенный тренировочный день ломает серию.
 */
export function currentStreak(
  visitDates: string[],
  isTrainDay: (iso: string) => boolean,
  today: string,
  lookback = 120,
): number {
  const visited = new Set(visitDates);
  let streak = 0;
  for (let i = 0; i < lookback; i += 1) {
    const iso = addDaysIso(today, -i);
    if (!isTrainDay(iso)) continue;
    if (visited.has(iso)) {
      streak += 1;
      continue;
    }
    if (i === 0) continue;
    break;
  }
  return streak;
}

/** Визиты за календарную неделю (ПН–ВС) по сегодня включительно. */
export function weekVisitDays(visitDates: string[], today: string): number {
  const start = weekStartIso(today);
  const end = addDaysIso(start, 7);
  return new Set(visitDates.filter((d) => d >= start && d < end && d <= today)).size;
}

/** Визиты за последние 7 дней, включая сегодня. Нужно для предупреждения о нагрузке. */
export function recentVisitDays(visitDates: string[], today: string): number {
  const from = addDaysIso(today, -6);
  return new Set(visitDates.filter((d) => d >= from && d <= today)).size;
}

/** Первая тренировочная дата начиная с from (включая from); null, если в горизонте её нет. */
export function nextVisitIso(isTrainDay: (iso: string) => boolean, from: string, horizon = 60): string | null {
  for (let i = 0; i < horizon; i += 1) {
    const iso = addDaysIso(from, i);
    if (isTrainDay(iso)) return iso;
  }
  return null;
}

/** «через» + время до слота: «30 мин», «2 часа», «5 часов». */
export function slotInLabel(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} мин`;
  const h = Math.round(hours);
  const mod10 = h % 10;
  const mod100 = h % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "час" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "часа" : "часов";
  return `${h} ${word}`;
}
