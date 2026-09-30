import { hoursUntilSlot } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { Surface, SectionLabel } from "@/components/app/bits";

/** Soft return nudge when client has gap since last visit. */
export function SoftReturnPanel() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const setTab = useStudio((s) => s.setTab);
  const me = activeClient({ clients, activeClientId });

  if (role !== "client" || !me) return null;

  const upcoming = bookings
    .filter((b) => b.clientId === me.id && hoursUntilSlot(b.date, b.time) > 0)
    .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`));

  if (upcoming.length > 0) return null;

  const past = bookings
    .filter((b) => b.clientId === me.id && hoursUntilSlot(b.date, b.time) <= 0)
    .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
  const last = past[0];
  if (!last) return null;

  const hours = Math.abs(hoursUntilSlot(last.date, last.time));
  if (hours < 72) return null;

  return (
    <Surface glow="ok">
      <SectionLabel>Мягкий возврат</SectionLabel>
      <p className="mt-2 text-sm text-muted-foreground">
        Давно не было записи. Выберите удобный слот в расписании.
      </p>
      <button
        type="button"
        className="pressable mt-3 h-10 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => setTab("schedule")}
      >
        К расписанию
      </button>
    </Surface>
  );
}
