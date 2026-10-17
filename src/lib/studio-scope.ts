import type { Booking } from "@/lib/studio-sync";

export function clientSlotView(bookings: Booking[], clientId: string | null) {
  const mine = clientId ? bookings.filter((booking) => booking.clientId === clientId) : [];
  const foreignHolds: Record<string, number> = {};
  for (const booking of bookings) {
    if (clientId && booking.clientId === clientId) continue;
    foreignHolds[booking.slotId] = (foreignHolds[booking.slotId] ?? 0) + 1;
  }
  return { bookings: mine, foreignHolds };
}
