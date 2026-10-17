/**
 * Стек экранов для кнопки «Назад» в шапке мини-приложения.
 * Хранится только в памяти вкладки: после перезагрузки начинается с главного экрана.
 */
export const TAB_HISTORY_LIMIT = 20;

/** Переход на другой экран: текущий запоминается, повтор того же экрана ничего не меняет. */
export function pushTab<T>(history: readonly T[], current: T, next: T): T[] {
  if (current === next) return [...history];
  return [...history, current].slice(-TAB_HISTORY_LIMIT);
}

/** Возврат: последний запомненный экран и стек без него. Пустой стек — нет куда возвращаться. */
export function popTab<T>(history: readonly T[]): { tab: T | null; history: T[] } {
  if (history.length === 0) return { tab: null, history: [] };
  return { tab: history[history.length - 1], history: history.slice(0, -1) };
}
