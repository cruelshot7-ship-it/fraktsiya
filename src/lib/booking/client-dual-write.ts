import type { Slot } from "@/data/studio";
import { TRAINER_TG_ID } from "@/data/studio";
import { getTelegramInitData } from "@/lib/telegram";
import { useStudio } from "@/lib/studio-store";

/** Canonical Neon booking id — must match bookSlotFn. */
export function neonBookingId(slotId: string, clientId: string) {
  return `bk_${slotId}_${clientId}`;
}

export function scheduleBookDualWrite(
  slot: Slot,
  clientId: string,
  onConflict: (reason: "full" | "already-booked") => void,
) {
  const initData = getTelegramInitData();
  if (!initData) return;
  void import("@/lib/booking/server")
    .then(({ bookSlotFn }) =>
      bookSlotFn({
        data: {
          initData,
          slotId: slot.id,
          clientId,
          startsAt: `${slot.date}T${slot.time}:00`,
          timezone: "Europe/Minsk",
          durationMin: slot.duration ?? 60,
          capacity: slot.capacity,
          ownerCoachId: slot.ownerId || String(TRAINER_TG_ID),
          kind: slot.capacity <= 1 ? "individual" : "group",
        },
      }),
    )
    .then((res) => {
      if (!res) return;
      if (res.ok === false && (res.reason === "full" || res.reason === "already-booked")) {
        onConflict(res.reason);
        return;
      }
      if (res.ok && res.bookingId) {
        const serverId = res.bookingId;
        const s = useStudio.getState();
        const bookings = s.bookings.map((b) => {
          if (b.slotId === slot.id && b.clientId === clientId && b.id !== serverId) {
            return { ...b, id: serverId };
          }
          return b;
        });
        useStudio.setState({ bookings });
      }
    })
    .catch(() => undefined);
}

/** Fire-and-forget server attendance after local check-in / no-show. */
export function scheduleAttendanceDualWrite(bookingId: string, attended: boolean) {
  const initData = getTelegramInitData();
  if (!initData || !bookingId) return;

  const s = useStudio.getState();
  const b = s.bookings.find((x) => x.id === bookingId);
  const serverId =
    b?.slotId && b?.clientId ? neonBookingId(b.slotId, b.clientId) : bookingId;

  void import("@/lib/booking/server")
    .then(({ markAttendanceFn }) =>
      markAttendanceFn({
        data: { initData, bookingId: serverId, attended },
      }),
    )
    .then((res) => {
      if (res && res.ok && serverId !== bookingId) {
        const st = useStudio.getState();
        useStudio.setState({
          bookings: st.bookings.map((x) =>
            x.id === bookingId ? { ...x, id: serverId } : x,
          ),
        });
      }
    })
    .catch(() => undefined);
}
