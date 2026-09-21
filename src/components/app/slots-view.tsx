import { useState } from "react";
import {
  addDays,
  DOW,
  formatDayMonth,
  initials,
  isoDate,
  isFrozen,
  isLateCancel,
  isSlotPast,
  parseISODate,
  placesLeft,
  shortName,
  startOfWeek,
  type Booking,
  type Slot,
} from "@/data/studio";
import { activeClient, slotTaken, useStudio } from "@/lib/studio-store";
import { Field, inputClass } from "@/components/app/bits";
import { cn } from "@/lib/utils";

export function SlotsView() {
  const role = useStudio((s) => s.role);
  return role === "trainer" ? <TrainerSlots /> : <ClientSlots />;
}

function useWeekDays() {
  const weekStart = useStudio((s) => s.weekStart);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const me = activeClient({ clients, activeClientId });
  const start = startOfWeek(parseISODate(weekStart));
  const days = Array.from({ length: 7 }, (_, i) => {
    const dayDate = addDays(start, i);
    const key = isoDate(dayDate);
    const daySlots = slots.filter((s) => s.date === key && !closedSlotIds.includes(s.id));
    const booked = bookings.filter((b) => b.date === key).length;
    const open = daySlots.filter((s) => slotTaken(s, bookings) < s.capacity && !isSlotPast(s.date, s.time)).length;
    return {
      key,
      date: dayDate,
      open,
      total: daySlots.length,
      booked,
      train: me.trainDays.includes(i),
    };
  });
  return { start, days, me };
}
