import { useState } from "react";
import {
  countdownLabel,
  formatLongDate,
  hoursUntilSlot,
  isSlotPast,
  shortName,
  type Booking,
  TRAINER_TG_ID,
} from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { SessionResultForm } from "@/components/app/session-result-form";
import { SessionExtras } from "@/components/app/session-extras";
import { PostSessionSummary } from "@/components/app/post-session-summary";

type Props = { bookingId: string };

export function SessionCard({ bookingId }: Props) {
  const bookings = useStudio((s) => s.bookings);
  const slots = useStudio((s) => s.slots);
  const clients = useStudio((s) => s.clients);
  const setTab = useStudio((s) => s.setTab);
  const checkIn = useStudio((s) => s.checkIn);
  const markNoShow = useStudio((s) => s.markNoShow);
  const cancelBooking = useStudio((s) => s.cancelBooking);
  const showToast = useStudio((s) => s.showToast);
  const role = useStudio((s) => s.role);

  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const slot = slots.find((s) => s.id === booking.slotId);
  const client = clients.find((c) => c.id === booking.clientId);
  const coachId = booking.coachId || client?.coachId || String(TRAINER_TG_ID);
  const programId = `prog_${coachId}_${booking.clientId}`;

  const hours = slot ? hoursUntilSlot(String(slot.date), String(slot.time)) : 999;
  const past = slot ? isSlotPast(String(slot.date), String(slot.time)) : false;
  const phase = booking.checkedIn ? "after" : past ? "missed" : hours <= 2 ? "soon" : "before";

  return (
    <div className="flex flex-col gap-3">
      <Surface className="p-4">
        <SectionLabel>Сессия</SectionLabel>
        <div className="mt-2 flex flex-col gap-1">
          <div className="text-base font-semibold">
            {slot ? `${formatLongDate(slot.date)} · ${slot.time}` : booking.date}
          </div>
          {client ? (
            <div className="text-sm text-muted-foreground">{shortName(client)}</div>
          ) : null}
          {slot ? (
            <div className="text-xs text-muted-foreground">{countdownLabel(slot.date, slot.time)}</div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!booking.checkedIn && !booking.noShow && !past ? (
            <button
              type="button"
              className="pressable rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => {
                checkIn(booking.id);
                showToast("Явка отмечена");
              }}
            >
              Я на месте
            </button>
          ) : null}
          {role === "trainer" && !booking.checkedIn && !booking.noShow ? (
            <button
              type="button"
              className="pressable rounded-xl bg-secondary px-3 py-2 text-sm"
              onClick={() => {
                markNoShow(booking.id);
                showToast("Неявка");
              }}
            >
              Неявка
            </button>
          ) : null}
          {!booking.checkedIn && !past ? (
            <button
              type="button"
              className="pressable rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground"
              onClick={() => {
                cancelBooking(booking.id);
                showToast("Запись отменена");
              }}
            >
              Отменить
            </button>
          ) : null}
          <button
            type="button"
            className="pressable rounded-xl bg-secondary px-3 py-2 text-sm"
            onClick={() => setTab("program")}
          >
            Программа
          </button>
          <button
            type="button"
            className="pressable rounded-xl bg-secondary px-3 py-2 text-sm"
            onClick={() => setTab("schedule")}
          >
            Следующий слот
          </button>
        </div>
      </Surface>

      {booking.checkedIn || phase !== "before" ? (
        <SessionResultForm
          bookingId={booking.id}
          clientId={booking.clientId}
          coachId={coachId}
          attendanceConfirmed={Boolean(booking.checkedIn)}
          programId={programId}
        />
      ) : null}
      <SessionExtras bookingId={booking.id} />
      {phase === "after" ? <PostSessionSummary bookingId={booking.id} /> : null}
    </div>
  );
}
