/**
 * Что делать с локальной записью клиента, когда сервер отказал.
 * «Слот занят»: записи на сервере нет, локальную убираем.
 * «Уже записан»: запись на сервере есть, её оставляем.
 */
export type BookConflict = "full" | "already-booked";

export function releasesLocalBooking(reason: BookConflict): boolean {
  return reason === "full";
}

export function bookConflictText(reason: BookConflict): string {
  return reason === "full" ? "Слот только что заняли. Обновите список." : "Запись уже есть на сервере.";
}
