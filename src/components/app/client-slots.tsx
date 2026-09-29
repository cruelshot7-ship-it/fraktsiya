import { useState } from "react";
import {
  addDays,
  DOW,
  formatDayMonth,
  isoDate,
  isFrozen,
  isSlotPast,
  parseISODate,
  placesLeft,
  startOfWeek,
} from "@/data/studio";
import { activeClient, slotTaken, useStudio } from "@/lib/studio-store";
import { EmptyHint } from "@/components/app/bits";
import { HabitSlotChip } from "@/components/app/habit-slot-chip";
import { cn } from "@/lib/utils";

function useWeekDays() {
  const weekStart = useStudio((s) => s.weekStart);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const start = startOfWeek(parseISODate(weekStart));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const key = isoDate(d);
    const daySlots = slots.filter((s) => s.date === key && !closedSlotIds.includes(s.id));
    const free = daySlots.reduce((acc, s) => {
      const left = Math.max(0, s.capacity - (s.seeded ?? 0) - slotTaken(s, bookings));
      return acc + left;
    }, 0);
    return { key, dow: DOW[i], free, label: String(d.getDate()) };
  });
  return { start, days };
}

export function ClientSlots() {
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const selectedDate = useStudio((s) => s.selectedDate);
  const selectDay = useStudio((s) => s.selectDay);
  const shiftWeek = useStudio((s) => s.shiftWeek);
  const book = useStudio((s) => s.book);
  const joinWaitlist = useStudio((s) => s.joinWaitlist);
  const waitlist = useStudio((s) => s.waitlist);
  const showToast = useStudio((s) => s.showToast);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const me = activeClient({ clients, activeClientId });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { start, days } = useWeekDays();
  const end = addDays(start, 6);

  if (!me) {
    return <EmptyHint title="Нет профиля" body="Тренер добавит вас в зал." />;
  }

  const daySlots = slots
    .filter((s) => s.date === selectedDate && !closedSlotIds.includes(s.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div>
      <HabitSlotChip />
      <WeekStrip
        days={days}
        selectedDate={selectedDate}
        label={`${start.getDate()}–${end.getDate()} ${formatDayMonth(isoDate(end)).split(" ").slice(1).join(" ")}`}
        onPrev={() => shiftWeek(-1)}
        onNext={() => shiftWeek(1)}
        onSelect={(key) => {
          selectDay(key);
          setPendingId(null);
        }}
      />

      <p className="font-display mb-2.5 text-xs tracking-[0.08em] text-muted-foreground uppercase">
        {formatDayMonth(selectedDate)}
        {me.trainDays.includes((parseISODate(selectedDate).getDay() + 6) % 7) ? ` · день ${me.firstName}` : ""}
      </p>

      <div className="stagger-in flex flex-col gap-2">
        {daySlots.length === 0 ? (
          <p className="py-8 text-sm leading-relaxed text-muted-foreground">
            На этот день слотов нет. Посмотрите соседние дни или следующую неделю.
          </p>
        ) : (
          daySlots.map((slot) => {
            const taken = slotTaken(slot, bookings);
            const left = Math.max(0, slot.capacity - (slot.seeded ?? 0) - taken);
            const mine = bookings.find((b) => b.slotId === slot.id && b.clientId === me.id);
            const waiting = waitlist.some((w) => w.slotId === slot.id && w.clientId === me.id);
            const past = isSlotPast(slot.date, slot.time);
            const frozen = isFrozen(me);
            return (
              <div
                key={slot.id}
                className={cn(
                  "rounded-xl bg-card p-4 shadow-border",
                  mine && "ring-1 ring-ok/40",
                  past && "opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-xl tabular-nums">{slot.time}</p>
                    <p className="mt-1 text-tiny text-muted-foreground">
                      {slot.duration} мин · {left > 0 ? placesLeft(left) : "занято"}
                    </p>
                  </div>
                  {mine ? (
                    <span className="text-xs font-medium text-ok">Вы записаны</span>
                  ) : past ? (
                    <span className="text-xs text-muted-foreground">Прошло</span>
                  ) : left > 0 && !frozen ? (
                    <button
                      type="button"
                      className="pressable h-10 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground"
                      disabled={pendingId === slot.id}
                      onClick={() => {
                        setPendingId(slot.id);
                        const ok = book(slot.id);
                        setPendingId(null);
                        if (ok) showToast("Запись создана.");
                      }}
                    >
                      Записаться
                    </button>
                  ) : left <= 0 && !waiting ? (
                    <button
                      type="button"
                      className="pressable h-10 rounded-xl bg-secondary px-3 text-xs"
                      onClick={() => {
                        joinWaitlist(slot.id);
                        showToast("В листе ожидания.");
                      }}
                    >
                      В лист
                    </button>
                  ) : waiting ? (
                    <span className="text-xs text-muted-foreground">В листе</span>
                  ) : frozen ? (
                    <span className="text-xs text-primary">Заморозка</span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function WeekStrip({
  days,
  selectedDate,
  label,
  onPrev,
  onNext,
  onSelect,
}: {
  days: { key: string; dow: string; free: number; label: string }[];
  selectedDate: string;
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" className="pressable text-xs text-muted-foreground" onClick={onPrev}>
          ←
        </button>
        <p className="text-xs text-muted-foreground">{label}</p>
        <button type="button" className="pressable text-xs text-muted-foreground" onClick={onNext}>
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const active = d.key === selectedDate;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelect(d.key)}
              className={cn(
                "pressable flex flex-col items-center rounded-lg py-2 text-2xs",
                active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              <span>{d.dow}</span>
              <span className="mt-0.5 font-medium tabular-nums">{d.label}</span>
              {d.free > 0 ? <span className="mt-0.5 size-1 rounded-full bg-ok" /> : <span className="mt-0.5 size-1" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
