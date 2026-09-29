import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";

type Phase = "before" | "during" | "after";

function phaseOf(booking: Booking): Phase {
  if (isSlotPast(booking.date, booking.time)) return "after";
  const h = hoursUntilSlot(booking.date, booking.time);
  if (h !== null && h <= 0.5 && h > -1.5) return "during";
  if (h !== null && h <= 0 && h > -(booking.duration / 60)) return "during";
  return "before";
}

type Props = { bookingId: string };

export function SessionCard({ bookingId }: Props) {
  const bookings = useStudio((s) => s.bookings);
  const clients = useStudio((s) => s.clients);
  const role = useStudio((s) => s.role);
  const checkIn = useStudio((s) => s.checkIn);
  const markNoShow = useStudio((s) => s.markNoShow);
  const setTab = useStudio((s) => s.setTab);
  const showToast = useStudio((s) => s.showToast);
  const [busy, setBusy] = useState(false);

  const booking = bookings.find((b) => b.id === bookingId);
  const phase = booking ? phaseOf(booking) : "before";

  const peers = useMemo(() => {
    if (!booking) return [];
    return bookings.filter((b) => b.slotId === booking.slotId && !b.noShow);
  }, [booking, bookings]);

  if (!booking) {
    return (
      <Surface>
        <p className="text-sm text-muted-foreground">Занятие не найдено.</p>
      </Surface>
    );
  }

  const who = clients.find((c) => c.id === booking.clientId);
  const label =
    phase === "before" ? "До занятия" : phase === "during" ? "Сейчас" : "После";

  function markPresent(id: string) {
    setBusy(true);
    try {
      checkIn(id);
      showToast("Присутствие отмечено.");
    } finally {
      setBusy(false);
    }
  }

  const coachId = who?.coachId || String(TRAINER_TG_ID);
  const programId = who ? `prog_${coachId}_${who.id}` : undefined;

  return (
    <div className="stagger-in flex flex-col gap-3">
      <Surface
        glow={
          phase === "during"
            ? "ok"
            : phase === "after" && !booking.checkedIn
              ? "alert"
              : undefined
        }
      >
        <SectionLabel>{label}</SectionLabel>
        <p className="font-display mt-2 text-2xl tracking-wide">{booking.time}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatLongDate(booking.date)} · {booking.duration} мин
          {role === "client" && !isSlotPast(booking.date, booking.time)
            ? ` · ${countdownLabel(booking.date, booking.time)}`
            : ""}
          {role === "trainer" && who ? ` · ${shortName(who)}` : ""}
        </p>

        {phase === "before" ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground">План — во вкладке «Сегодня».</p>
            <button
              type="button"
              className="pressable h-11 w-full rounded-xl bg-secondary text-sm font-medium"
              onClick={() => setTab("program")}
            >
              Открыть план
            </button>
          </div>
        ) : null}

        {phase === "during" ? (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="pressable h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => setTab("program")}
            >
              План
            </button>
            {role === "client" && !booking.checkedIn ? (
              <button
                type="button"
                disabled={busy}
                className="pressable h-11 w-full rounded-xl bg-ok text-sm font-medium text-ok-foreground"
                onClick={() => markPresent(booking.id)}
              >
                Я на месте
              </button>
            ) : null}
            {role === "trainer" && !booking.checkedIn && !booking.noShow ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className="pressable h-11 flex-1 rounded-xl bg-ok text-sm font-medium text-ok-foreground"
                  onClick={() => markPresent(booking.id)}
                >
                  Был
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="pressable h-11 flex-1 rounded-xl bg-secondary text-sm"
                  onClick={() => markNoShow(booking.id)}
                >
                  Неявка
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {phase === "after" ? (
          <div className="mt-4 space-y-3">
            {!booking.checkedIn && !booking.noShow ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  className={cn("pressable h-11 flex-1 rounded-xl text-sm font-medium bg-ok text-ok-foreground")}
                  onClick={() => markPresent(booking.id)}
                >
                  Был на занятии
                </button>
                {role === "trainer" ? (
                  <button
                    type="button"
                    disabled={busy}
                    className="pressable h-11 flex-1 rounded-xl bg-secondary text-sm"
                    onClick={() => markNoShow(booking.id)}
                  >
                    Неявка
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ok">
                {booking.checkedIn ? "Присутствие зафиксировано." : "Отмечена неявка."}
              </p>
            )}
            {role === "client" ? (
              <button
                type="button"
                className="pressable h-11 w-full rounded-xl bg-primary text-sm font-medium"
                onClick={() => setTab("slots")}
              >
                Следующий слот
              </button>
            ) : null}
          </div>
        ) : null}
      </Surface>

      {phase !== "before" ? (
        <SessionResultForm
          bookingId={booking.id}
          clientId={booking.clientId}
          coachId={coachId}
          attendanceConfirmed={Boolean(booking.checkedIn)}
          programId={programId}
        />
      ) : null}
      <SessionExtras bookingId={booking.id} />
    </div>
  );
}
