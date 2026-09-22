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
import { Field, inputClass, EmptyHint } from "@/components/app/bits";
import { TrainerSlots } from "@/components/app/trainer-slots";
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
      train: me?.trainDays.includes(i) ?? false,
    };
  });
  return { start, days, me };
}

function ClientSlots() {
  const selectedDate = useStudio((s) => s.selectedDate);
  const weekStart = useStudio((s) => s.weekStart);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const shiftWeek = useStudio((s) => s.shiftWeek);
  const selectDay = useStudio((s) => s.selectDay);
  const bookSlot = useStudio((s) => s.bookSlot);
  const cancelBooking = useStudio((s) => s.cancelBooking);
  const joinWaitlist = useStudio((s) => s.joinWaitlist);
  const leaveWaitlist = useStudio((s) => s.leaveWaitlist);
  const waitlist = useStudio((s) => s.waitlist);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const openNote = useStudio((s) => s.openNote);
  const { start, days, me } = useWeekDays();
  const end = addDays(start, 6);
  const minWeek = isoDate(startOfWeek(new Date()));
  const canPrev = weekStart > minWeek;
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!me) {
    return <EmptyHint>Слоты появятся в вашем профиле, когда тренер добавит вас в зал.</EmptyHint>;
  }

  const daySlots = slots
    .filter((s) => s.date === selectedDate && !closedSlotIds.includes(s.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div>
      <WeekStrip
        days={days}
        selectedDate={selectedDate}
        canPrev={canPrev}
        label={`${start.getDate()}–${end.getDate()} ${formatDayMonth(isoDate(end)).split(" ").slice(1).join(" ")}`}
        onPrev={() => shiftWeek(-1)}
        onNext={() => shiftWeek(1)}
        onSelect={(key) => {
          selectDay(key);
          setPendingId(null);
        }}
        mode="client"
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
            const past = isSlotPast(slot.date, slot.time);
            const taken = slotTaken(slot, bookings);
            const full = taken >= slot.capacity;
            const mine = bookings.some((b) => b.slotId === slot.id && b.clientId === me.id);
            const waiting = waitlist.some((w) => w.slotId === slot.id && w.clientId === me.id);
            const left = slot.capacity - taken;
            const locked = past && !mine;
            const pending = pendingId === slot.id;
            return (
              <div
                key={slot.id}
                className={cn(
                  "overflow-hidden rounded-xl bg-card shadow-border",
                  mine && "glow-ok",
                  pending && "glow-alert",
                  waiting && "glow-soft",
                  past && !mine && "opacity-45",
                )}
              >
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setPendingId(pending ? null : slot.id);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className="font-display w-16 shrink-0 text-xl font-semibold">{slot.time}</span>
                  <span className="flex-1 pl-2 text-xs text-muted-foreground">{slot.duration} мин</span>
                  <span className={cn("text-xs font-medium", mine || (!full && !past) ? "text-ok" : "text-muted-foreground")}>
                    {mine ? "вы записаны" : past ? "прошло" : waiting ? "в листе" : full ? "занято" : placesLeft(left)}
                  </span>
                </button>
                {pending ? (
                  <div className="border-t border-primary/30 px-4 py-3">
                    {mine ? (
                      <>
                        <p className="text-sm">Отменить запись на {DOW[(parseISODate(slot.date).getDay() + 6) % 7]} {slot.time}?</p>
                        <p className="mt-1 text-tiny text-muted-foreground">
                          {notifyPrefs.notifyTrainer
                            ? isLateCancel(slot.date, slot.time, notifyPrefs.windowHours)
                              ? `Поздняя отмена: занятие сгорит (меньше ${notifyPrefs.windowHours} ч).`
                              : "Занятие вернётся на баланс. Тренер получит уведомление."
                            : "Тренер не получит уведомление — оно выключено."}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingId(null)}
                            className="pressable h-11 rounded-lg bg-secondary text-sm text-muted-foreground"
                          >
                            Назад
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const booking = bookings.find((b) => b.slotId === slot.id && b.clientId === me.id);
                              if (booking) cancelBooking(booking.id, "client");
                              setPendingId(null);
                            }}
                            className="pressable h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                          >
                            Отменить
                          </button>
                        </div>
                      </>
                    ) : full ? (
                      <>
                        <p className="text-sm">
                          {waiting ? "Вы в листе ожидания. Снять?" : "Слот занят. Встать в лист? Если место освободится — запишем сами."}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingId(null)}
                            className="pressable h-11 rounded-lg bg-secondary text-sm text-muted-foreground"
                          >
                            Назад
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (waiting) leaveWaitlist(slot.id);
                              else joinWaitlist(slot.id);
                              setPendingId(null);
                            }}
                            className="pressable h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                          >
                            {waiting ? "Снять" : "В лист"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm">
                          Записаться на {DOW[(parseISODate(slot.date).getDay() + 6) % 7]} {slot.time}?
                        </p>
                        {me.sessionsLeft <= 0 ? (
                          <button type="button" className="mt-1 text-tiny text-primary" onClick={() => openNote()}>
                            На балансе нет занятий — напишите тренеру.
                          </button>
                        ) : isFrozen(me) ? (
                          <p className="mt-1 text-tiny text-primary">Пакет заморожен до {formatDayMonth(me.frozenUntil!)}.</p>
                        ) : bookings.some((b) => b.clientId === me.id && b.date === slot.date && b.slotId !== slot.id && !isSlotPast(b.date, b.time)) ? (
                          <p className="mt-1 text-tiny text-muted-foreground">У вас уже есть запись в этот день. Можно вторую — подтвердите.</p>
                        ) : null}
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPendingId(null)}
                            className="pressable h-11 rounded-lg bg-secondary text-sm text-muted-foreground"
                          >
                            Отмена
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              bookSlot(slot.id);
                              setPendingId(null);
                            }}
                            className="pressable h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                          >
                            Подтвердить
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
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
  canPrev,
  label,
  hideLabel,
  onPrev,
  onNext,
  onSelect,
  mode,
}: {
  days: { key: string; date: Date; open: number; total: number; booked: number; train: boolean }[];
  selectedDate: string;
  canPrev: boolean;
  label: string;
  hideLabel?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (key: string) => void;
  mode: "client" | "trainer";
}) {
  return (
    <div>
      {hideLabel ? null : (
        <div className="flex items-center justify-between pt-1 pb-2.5">
          <button
            type="button"
            disabled={!canPrev}
            onClick={onPrev}
            className="grid size-8 place-items-center rounded-lg bg-card text-base shadow-border disabled:opacity-30"
            aria-label="Предыдущая неделя"
          >
            ‹
          </button>
          <p className="font-display text-sm tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
          <button
            type="button"
            onClick={onNext}
            className="grid size-8 place-items-center rounded-lg bg-card text-base shadow-border"
            aria-label="Следующая неделя"
          >
            ›
          </button>
        </div>
      )}
      {hideLabel ? (
        <div className="mb-2 flex justify-end gap-1">
          <button type="button" disabled={!canPrev} onClick={onPrev} className="grid size-7 place-items-center text-muted-foreground disabled:opacity-30">
            ‹
          </button>
          <button type="button" onClick={onNext} className="grid size-7 place-items-center text-muted-foreground">
            ›
          </button>
        </div>
      ) : null}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pt-1 pb-4">
        {days.map((day, i) => {
          const selected = selectedDate === day.key;
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelect(day.key)}
              className={cn(
                "min-w-11 flex-1 rounded-xl px-1 py-2 text-center shadow-border",
                selected && mode === "trainer" && "glow-ok bg-ok-dim",
                selected && mode === "client" && "glow-alert bg-primary-dim",
                !selected && "bg-card",
              )}
            >
              <span className="block text-2xs tracking-wide text-muted-foreground">
                {DOW[i]}
                {mode === "client" && day.train ? " ·" : ""}
              </span>
              <span className="font-display mt-0.5 block text-lg leading-none font-semibold">{day.date.getDate()}</span>
              <span className="mt-0.5 block text-3xs text-muted-foreground">
                {mode === "trainer"
                  ? day.total === 0
                    ? "—"
                    : `${day.booked} зап.`
                  : day.total === 0
                    ? "—"
                    : day.open
                      ? `${day.open} своб.`
                      : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
