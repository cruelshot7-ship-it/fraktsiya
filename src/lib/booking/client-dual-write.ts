import type { Slot } from "@/data/studio";
import { TRAINER_TG_ID } from "@/data/studio";
import { getTelegramInitData } from "@/lib/telegram";

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
          durationMin: slot.duration,
          capacity: slot.capacity,
          ownerCoachId: slot.ownerId || String(TRAINER_TG_ID),
          kind: slot.capacity <= 1 ? "individual" : "group",
        },
      }),
    )
    .then((res) => {
      if (res && res.ok === false && (res.reason === "full" || res.reason === "already-booked")) {
        onConflict(res.reason);
      }
    })
    .catch(() => undefined);
}
