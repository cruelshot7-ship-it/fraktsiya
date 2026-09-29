import { useMemo } from "react";
import { formatLongDate, isSlotPast, shortName } from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";

/** One-screen recap after a finished booking. */
export function PostSessionSummary({ bookingId }: { bookingId: string }) {
  const bookings = useStudio((s) => s.bookings);
  const clients = useStudio((s) => s.clients);
  const role = useStudio((s) => s.role);
  const setTab = useStudio((s) => s.setTab);
  const booking = bookings.find((b) => b.id === bookingId);

  const client = useMemo(
    () => (booking ? clients.find((c) => c.id === booking.clientId) : undefined),
    [booking, clients],
  );

  if (!booking || !isSlotPast(booking.date, booking.time)) return null;

  const status = booking.noShow
    ? "Неявка"
    : booking.checkedIn
      ? "Был на занятии"
      : "Явка не отмечена";

  return (
    <Surface glow={booking.checkedIn ? "ok" : booking.noShow ? "alert" : "soft"}>
      <SectionLabel>Итог занятия</SectionLabel>
      <p className="font-display mt-2 text-xl tracking-wide">{booking.time}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatLongDate(booking.date)}
        {role === "trainer" && client ? ` · ${shortName(client)}` : ""}
      </p>
      <p className="mt-2 text-sm">{status}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="pressable h-11 rounded-xl bg-secondary text-sm font-medium"
          onClick={() => setTab("program")}
        >
          План
        </button>
        <button
          type="button"
          className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => setTab(role === "trainer" ? "clients" : "slots")}
        >
          {role === "trainer" ? "Клиенты" : "Следующий слот"}
        </button>
      </div>
    </Surface>
  );
}
