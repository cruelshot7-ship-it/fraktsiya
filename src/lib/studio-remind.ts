import type { Booking } from "../data/studio.ts";

export function slotHours(date: string, time: string, now: number) {
  const [hour, minute] = time.split(":").map(Number);
  const stamp = new Date(`${date}T00:00:00`);
  stamp.setHours(hour || 0, minute || 0, 0, 0);
  return (stamp.getTime() - now) / 3_600_000;
}

export function dueReminders(bookings: Booking[], now: number) {
  const due: { id: string; kind: "24" | "2" }[] = [];
  for (const booking of bookings) {
    if (booking.checkedIn || booking.noShow) continue;
    const hours = slotHours(booking.date, booking.time, now);
    if (hours <= 0) continue;
    if (hours <= 3 && !booking.reminded2) due.push({ id: booking.id, kind: "2" });
    else if (hours <= 26 && hours > 12 && !booking.reminded24) due.push({ id: booking.id, kind: "24" });
  }
  return due;
}

export function markReminder(bookings: Booking[], id: string, kind: "24" | "2") {
  return bookings.map((booking) => {
    if (booking.id !== id) return booking;
    if (kind === "2") return { ...booking, reminded2: true };
    return { ...booking, reminded24: true };
  });
}

export function remindToken(id: string) {
  return id.slice(-16);
}

export function findByToken(bookings: Booking[], token: string) {
  return bookings.find((booking) => booking.id.endsWith(token) || remindToken(booking.id) === token) ?? null;
}
