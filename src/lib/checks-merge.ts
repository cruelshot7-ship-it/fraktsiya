/**
 * Слияние отметок дня (checks) между копией тренера, копией клиента и сервером.
 * Pure: без импортов, проверяется node --test.
 *
 * Ключи: `${clientId}:${date}` — отметки упражнений, `${clientId}:${date}:sets` — отметки подходов,
 * `${clientId}:${date}:at` — время последней правки дня (ms). Весь день — одна группа: побеждает та сторона,
 * у которой правка свежее. Так отметка клиента не затирается устаревшей копией тренера, и наоборот,
 * а снятая отметка (пустой массив) доходит до сервера.
 */

export type CheckMap = Record<string, string[]>;

const DAY_SUFFIX = /:(sets|at)$/;

export function dayKeyOf(key: string): string {
  return key.replace(DAY_SUFFIX, "");
}

export function stampOf(checks: CheckMap, day: string): number {
  const raw = checks[`${day}:at`]?.[0];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * current — локальная или серверная копия, incoming — пришедшая копия.
 * ids — клиенты, которых касается слияние; null — все ключи. Ключи вне области берутся из current.
 * При равной метке побеждает incoming (как и раньше).
 */
export function mergeChecks(current: CheckMap, incoming: CheckMap, ids: Set<string> | null = null): CheckMap {
  const inScope = (key: string) => (ids === null ? true : [...ids].some((id) => key.startsWith(`${id}:`)));
  const out: CheckMap = {};
  for (const [key, value] of Object.entries(current)) {
    if (!inScope(key)) out[key] = value;
  }
  const days = new Set(
    [...Object.keys(current), ...Object.keys(incoming)].filter(inScope).map(dayKeyOf),
  );
  for (const day of days) {
    const fromIncoming = stampOf(incoming, day) >= stampOf(current, day);
    const source = fromIncoming ? incoming : current;
    for (const key of [day, `${day}:sets`, `${day}:at`]) {
      if (source[key]) out[key] = source[key];
    }
  }
  return out;
}

/** Убирает отметки клиентов из набора (например, перешедших к другому тренеру). */
export function dropCheckIds(checks: CheckMap, ids: Set<string>): CheckMap {
  const out: CheckMap = {};
  for (const [key, value] of Object.entries(checks)) {
    if (![...ids].some((id) => key.startsWith(`${id}:`))) out[key] = value;
  }
  return out;
}
