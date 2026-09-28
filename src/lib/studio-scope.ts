import type { Booking, StudioPayload } from "@/lib/studio-sync";

export function clientSlotView(bookings: Booking[], clientId: string | null) {
  const mine = clientId ? bookings.filter((booking) => booking.clientId === clientId) : [];
  const foreignHolds: Record<string, number> = {};
  for (const booking of bookings) {
    if (clientId && booking.clientId === clientId) continue;
    foreignHolds[booking.slotId] = (foreignHolds[booking.slotId] ?? 0) + 1;
  }
  return { bookings: mine, foreignHolds };
}

export function scopeClientPayload(payload: StudioPayload, telegramId: string): StudioPayload {
  const mine = payload.clients.find((client) => client.telegramId === telegramId);
  const id = mine?.id ?? null;
  const slots = clientSlotView(payload.bookings, id);
  return {
    ...payload,
    clients: mine ? [mine] : [],
    bookings: slots.bookings,
    foreignHolds: slots.foreignHolds,
    food: id ? payload.food.filter((row) => row.clientId === id) : [],
    dayChecks: id ? (payload.dayChecks ?? []).filter((row) => row.clientId === id) : [],
    lifts: id ? payload.lifts.filter((row) => row.clientId === id) : [],
    workoutLogs: id ? payload.workoutLogs.filter((row) => row.clientId === id) : [],
    notices: id ? payload.notices.filter((row) => row.audience === "client" && row.clientId === id) : [],
    waitlist: id ? payload.waitlist.filter((row) => row.clientId === id) : [],
    checks: id
      ? Object.fromEntries(Object.entries(payload.checks).filter(([key]) => key.startsWith(`${id}:`)))
      : {},
    joinRequests: (payload.joinRequests ?? []).filter((row) => row.telegramId === telegramId),
    coaches: [],
    removedClientIds: [],
  };
}
