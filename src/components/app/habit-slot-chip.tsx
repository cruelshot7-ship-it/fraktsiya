import { isSlotPast } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { suggestNextSlot } from "@/lib/next-slot";
import { enqueueBookingConfirmed } from "@/lib/notify/hook-booking";
import { SectionLabel, Surface } from "@/components/app/bits";

export function HabitSlotChip() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const book = useStudio((s) => s.book);
  const showToast = useStudio((s) => s.showToast);
  const client = activeClient({ clients, activeClientId });

  if (role !== "client" || !client || !client.trainTimes?.length) return null;

  const preferred = client.trainTimes[0];
  const today = new Date().toISOString().slice(0, 10);

  const habitSlot =
    slots
      .filter(
        (s) =>
          !isSlotPast(s.date, s.time) &&
          s.time === preferred &&
          !bookings.some((b) => b.slotId === s.id && b.clientId === client.id),
      )
      .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0] ??
    suggestNextSlot({
      slots,
      bookings,
      clientId: client.id,
      afterDate: today,
      coachId: client.coachId,
    })?.slot;

  if (!habitSlot) return null;

  const taken = bookings.filter((b) => b.slotId === habitSlot.id && !b.noShow).length;
  const free = habitSlot.capacity - (habitSlot.seeded ?? 0) - taken;
  if (free <= 0) return null;

  return (
    <Surface glow="soft">
      <SectionLabel>Привычное время</SectionLabel>
      <p className="mt-2 text-sm">
        {habitSlot.date} · <span className="font-medium tabular-nums">{habitSlot.time}</span>
        {habitSlot.time === preferred ? " · как обычно" : ""}
      </p>
      <button
        type="button"
        className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => {
          const ok = book(habitSlot.id);
          if (ok) {
            enqueueBookingConfirmed({
              telegramId: client.telegramId,
              bookingId: `local_${habitSlot.id}_${client.id}`,
              clientId: client.id,
              date: habitSlot.date,
              time: habitSlot.time,
            });
            showToast("Запись на привычное время.");
          }
        }}
      >
        Записаться в один тап
      </button>
    </Surface>
  );
}
