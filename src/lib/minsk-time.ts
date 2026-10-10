/**
 * Club wall-clock time. The studio is in Grodno (UTC+3, no DST since 2011),
 * so slot times are interpreted in that zone, never in the device's or the server's zone.
 */
export const CLUB_UTC_OFFSET = "+03:00";

/** Epoch ms of a slot start. Returns NaN for malformed input. */
export function slotStartMs(date: string, time: string): number {
  const hm = /^\d{1,2}:\d{2}$/.test(time) ? time.padStart(5, "0") : "00:00";
  return Date.parse(`${date}T${hm}:00${CLUB_UTC_OFFSET}`);
}

export function hoursUntilSlotAt(date: string, time: string, nowMs: number): number {
  return (slotStartMs(date, time) - nowMs) / 3600000;
}

/** A cancellation is late when the slot starts in less than `windowHours` from `nowMs`. */
export function isLateCancelAt(date: string, time: string, nowMs: number, windowHours: number): boolean {
  return hoursUntilSlotAt(date, time, nowMs) < windowHours;
}
