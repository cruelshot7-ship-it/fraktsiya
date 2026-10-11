/**
 * Свежесть подписи Telegram initData. Окно 24 часа: старые подписи не принимаем.
 * Чистая функция, без зависимостей: тестируется без сервера.
 */
export const INIT_DATA_MAX_AGE_SEC = 86400;

export function isFreshAuthDate(authDate: number, nowSec: number, maxAgeSec = INIT_DATA_MAX_AGE_SEC): boolean {
  if (!authDate || !Number.isFinite(authDate)) return false;
  return Math.abs(nowSec - authDate) <= maxAgeSec;
}
