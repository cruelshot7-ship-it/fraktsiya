/**
 * Suggest the next bookable slot for a client after a completed session.
 */
import type { Booking, Slot } from "@/data/studio";

export type NextSlotSuggestion = {
  slot: Slot;
  reason: string;
};

/**
 * Pick the earliest open future slot of the same coach that is not full
 * and not already booked by this client.
 */
export function suggestNextSlot(opts: {
  slots: Slot[];
  bookings: Booking[];
  clientId: string;
  closedSlotIds?: string[];
  afterDate?: string;
  afterTime?: string;
  coachId?: string | null;
}): NextSlotSuggestion | null {
  const closed = new Set(opts.closedSlotIds ?? []);
  const afterKey =
    opts.afterDate && opts.afterTime
      ? `${opts.afterDate}_${opts.afterTime}`
      : opts.afterDate
        ? `${opts.afterDate}_00:00`
        : "";

  const candidates = opts.slots
    .filter((s) => {
      if (closed.has(s.id)) return false;
      if (afterKey && s.id <= afterKey && !s.id.startsWith("extra_")) {
        if (/^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(s.id) && s.id <= afterKey) return false;
      }
      if (opts.afterDate && s.date < opts.afterDate) return false;
      if (opts.afterDate && s.date === opts.afterDate && opts.afterTime && s.time <= opts.afterTime) {
        return false;
      }
      if (opts.coachId && s.ownerId && s.ownerId !== opts.coachId) return false;
      const taken =
        (s.seeded || 0) + opts.bookings.filter((b) => b.slotId === s.id && !b.noShow).length;
      if (taken >= s.capacity) return false;
      if (opts.bookings.some((b) => b.slotId === s.id && b.clientId === opts.clientId)) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const slot = candidates[0];
  if (!slot) return null;
  return {
    slot,
    reason: `Ближайшее свободное место: ${slot.date} · ${slot.time}`,
  };
}
