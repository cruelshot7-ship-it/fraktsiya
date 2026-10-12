import { specialDataAllowed, type Consent } from "@/lib/privacy";

/**
 * Запись клиента о здоровье (вес, замеры, еда, шаги/сон/вода/самочувствие) принимается,
 * только если у клиента действует согласие. Без согласия сервер оставляет то, что уже хранится,
 * а присланное не записывает. Остальные данные клиента (записи, программа, баланс) не затрагиваются.
 */
export function healthWriteAllowed(consent: Consent | null | undefined): boolean {
  return specialDataAllowed(consent);
}

/** Поля тела клиента: без согласия — прежние значения, с согласием — то, что получилось после слияния. */
export function guardBodyFields<T>(allowed: boolean, stored: T, merged: T): T {
  return allowed ? merged : stored;
}

/**
 * Строки клиента (журнал еды, дни): без согласия — строки клиента остаются как были.
 * merged — результат слияния, в котором затронуты только строки этого клиента.
 */
export function guardRows<T>(allowed: boolean, stored: T[], merged: T[]): T[] {
  return allowed ? merged : stored;
}
