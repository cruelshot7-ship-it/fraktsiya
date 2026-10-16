import { formatLongDate } from "@/data/studio";

export type BookingAlertKind = "book" | "cancel";

/** Тренер получает сообщения о записях и отменах, пока не выключил это в настройках (по умолчанию включено). */
export function trainerAlertsEnabled(prefs: { notifyTrainer?: boolean } | null | undefined): boolean {
  return prefs?.notifyTrainer !== false;
}

/** Текст сообщения тренеру в Telegram. Короткий, без лишних данных клиента. */
export function trainerBookingAlertText(kind: BookingAlertKind, clientName: string, date: string, time: string): string {
  const who = clientName.trim() || "Клиент";
  const head = kind === "book" ? "Новая запись" : "Отмена записи";
  return `${head}: ${who}\n${formatLongDate(date)} · ${time}`;
}
