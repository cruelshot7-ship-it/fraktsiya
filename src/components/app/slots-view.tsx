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
  const { start, days, me } = useWeekDays();
  const end = addDays(start, 6);
  const minWeek = isoDate(startOfWeek(new Date()));
  const canPrev = weekStart > minWeek;
  const [pendingId, setPendingId] = useState<string | null>(null);

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
                          <p className="mt-1 text-tiny text-primary">На балансе нет занятий — напишите тренеру.</p>
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

function TrainerSlots() {
  const selectedDate = useStudio((s) => s.selectedDate);
  const weekStart = useStudio((s) => s.weekStart);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const shiftWeek = useStudio((s) => s.shiftWeek);
  const selectDay = useStudio((s) => s.selectDay);
  const addSlot = useStudio((s) => s.addSlot);
  const closeSlot = useStudio((s) => s.closeSlot);
  const openSlot = useStudio((s) => s.openSlot);
  const cancelBooking = useStudio((s) => s.cancelBooking);
  const cancelSlotBookings = useStudio((s) => s.cancelSlotBookings);
  const rescheduleBooking = useStudio((s) => s.rescheduleBooking);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const bookSlot = useStudio((s) => s.bookSlot);
  const { days } = useWeekDays();
  const minWeek = isoDate(startOfWeek(new Date()));
  const canPrev = weekStart > minWeek;
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [time, setTime] = useState("18:00");
  const [cap, setCap] = useState("3");
  const [moveId, setMoveId] = useState<string | null>(null);
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);
  const [pendingMassId, setPendingMassId] = useState<string | null>(null);

  const daySlots = slots
    .filter((s) => s.date === selectedDate)
    .sort((a, b) => a.time.localeCompare(b.time));

  const altSlots = slots.filter(
    (s) => s.date === selectedDate && !closedSlotIds.includes(s.id) && !isSlotPast(s.date, s.time),
  );

  return (
    <div>
      <WeekStrip
        days={days}
        selectedDate={selectedDate}
        canPrev={canPrev}
        label=""
        hideLabel
        onPrev={() => shiftWeek(-1)}
        onNext={() => shiftWeek(1)}
        onSelect={(key) => {
          selectDay(key);
          setOpenId(null);
        }}
        mode="trainer"
      />

      <div className="stagger-in flex flex-col gap-2">
        {daySlots.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">На этот день слотов нет.</p>
        ) : (
          daySlots.map((slot) => (
            <TrainerSlotCard
              key={slot.id}
              slot={slot}
              bookings={bookings}
              closed={closedSlotIds.includes(slot.id)}
              expanded={openId === slot.id}
              onToggle={() => setOpenId(openId === slot.id ? null : slot.id)}
              onClose={() => closeSlot(slot.id)}
              onOpen={() => openSlot(slot.id)}
              onOpenClient={openClientSheet}
              onCancel={(id) => setPendingCancelId(pendingCancelId === id ? null : id)}
              pendingCancelId={pendingCancelId}
              onConfirmCancel={(id) => {
                cancelBooking(id, "trainer");
                setPendingCancelId(null);
              }}
              pendingMass={pendingMassId === slot.id}
              onMassStart={() => setPendingMassId(pendingMassId === slot.id ? null : slot.id)}
              onCancelAll={() => {
                cancelSlotBookings(slot.id);
                setPendingMassId(null);
                setOpenId(null);
              }}
              moveId={moveId}
              onMoveStart={setMoveId}
              altSlots={altSlots.filter((s) => s.id !== slot.id)}
              onReschedule={(bookingId, newSlotId) => {
                if (rescheduleBooking(bookingId, newSlotId)) setMoveId(null);
              }}
              onBookClient={(clientId) => bookSlot(slot.id, clientId)}
            />
          ))
        )}
      </div>

      {adding ? (
        <div className="mt-3 rounded-xl bg-card p-4 shadow-border">
          <p className="font-display text-xs tracking-[0.08em] text-muted-foreground uppercase">Новый слот</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Время">
              <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Мест">
              <input className={inputClass} inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="h-11 rounded-lg bg-secondary text-sm" onClick={() => setAdding(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="pressable h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => {
                const capacity = Number(cap);
                if (!time || !capacity) return;
                addSlot(selectedDate, time, capacity);
                setAdding(false);
              }}
            >
              Открыть
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pressable mt-3 h-12 w-full rounded-xl bg-card text-sm shadow-border"
        >
          Добавить слот
        </button>
      )}
    </div>
  );
}

function TrainerSlotCard({
  slot,
  bookings,
  closed,
  expanded,
  onToggle,
  onClose,
  onOpen,
  onOpenClient,
  onCancel,
  pendingCancelId,
  onConfirmCancel,
  pendingMass,
  onMassStart,
  onCancelAll,
  moveId,
  onMoveStart,
  altSlots,
  onReschedule,
  onBookClient,
}: {
  slot: Slot;
  bookings: Booking[];
  closed: boolean;
  expanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpen: () => void;
  onOpenClient: (id: string) => void;
  onCancel: (id: string) => void;
  pendingCancelId: string | null;
  onConfirmCancel: (id: string) => void;
  pendingMass: boolean;
  onMassStart: () => void;
  onCancelAll: () => void;
  moveId: string | null;
  onMoveStart: (id: string | null) => void;
  altSlots: Slot[];
  onReschedule: (bookingId: string, slotId: string) => void;
  onBookClient: (clientId: string) => void;
}) {
  const clients = useStudio((s) => s.clients);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const [pick, setPick] = useState(false);
  const people = bookings
    .filter((b) => b.slotId === slot.id)
    .map((b) => ({ booking: b, client: clients.find((c) => c.id === b.clientId) }))
    .filter((x) => x.client);
  const taken = slotTaken(slot, bookings);
  const free = taken === 0;

  return (
    <div className={cn("overflow-hidden rounded-xl bg-card shadow-border", closed && "opacity-50")}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3.5 text-left">
        <span className="w-16 shrink-0">
          <span className="font-display block text-xl font-semibold leading-none">{slot.time}</span>
          <span className="mt-2 flex gap-1">
            {Array.from({ length: slot.capacity }, (_, i) => (
              <span
                key={i}
                className={cn("h-1 w-3 rounded-full", i < taken ? "bg-ok" : "bg-secondary")}
              />
            ))}
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 pt-0.5">
          {people.map(({ client }) =>
            client ? (
              <span key={client.id} className="font-display text-tiny tracking-wide text-muted-foreground">
                {initials(client)}
              </span>
            ) : null,
          )}
        </span>
        <span className="pt-0.5 text-tiny text-muted-foreground">
          {closed ? "закрыт" : free ? "свободно" : `${taken} из ${slot.capacity}`}
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-hairline px-4 py-3">
          {people.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {closed ? "Слот скрыт у клиентов." : "Никто не записан. Слот виден клиентам."}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {people.map(({ booking, client }) =>
                client ? (
                  <div key={booking.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">
                        {client.firstName} {client.lastName.charAt(0)}.
                      </p>
                      <div className="flex gap-2">
                        <button type="button" className="text-tiny text-ok" onClick={() => onOpenClient(client.id)}>
                          Открыть
                        </button>
                        <button type="button" className="text-tiny text-muted-foreground" onClick={() => onMoveStart(booking.id)}>
                          Перенести
                        </button>
                        <button type="button" className="text-tiny text-primary" onClick={() => onCancel(booking.id)}>
                          Отменить
                        </button>
                      </div>
                    </div>
                    {pendingCancelId === booking.id ? (
                      <div className="rounded-lg bg-primary-dim p-2.5">
                        <p className="text-tiny">
                          {notifyPrefs.notifyClient
                            ? `Отменить запись ${client.firstName} и отправить уведомление?`
                            : `Отменить запись ${client.firstName} без уведомления?`}
                        </p>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <button type="button" className="h-9 rounded-lg bg-secondary text-tiny" onClick={() => onCancel(booking.id)}>
                            Назад
                          </button>
                          <button
                            type="button"
                            className="h-9 rounded-lg bg-primary text-tiny font-medium text-primary-foreground"
                            onClick={() => onConfirmCancel(booking.id)}
                          >
                            Подтвердить
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {moveId === booking.id ? (
                      <div className="flex flex-wrap gap-1">
                        {altSlots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="h-8 rounded-lg bg-secondary px-2 text-tiny"
                            onClick={() => onReschedule(booking.id, s.id)}
                          >
                            {s.time}
                          </button>
                        ))}
                        <button type="button" className="h-8 px-2 text-tiny text-muted-foreground" onClick={() => onMoveStart(null)}>
                          свернуть
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null,
              )}
            </div>
          )}
          {!closed && !isSlotPast(slot.date, slot.time) && taken < slot.capacity ? (
            pick ? (
              <div className="mt-3 flex flex-col gap-1.5">
                <p className="text-tiny text-muted-foreground">Кого записать</p>
                {clients
                  .filter((c) => !people.some((p) => p.client?.id === c.id) && (c.sessionsLeft ?? 0) > 0 && !isFrozen(c))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        onBookClient(c.id);
                        setPick(false);
                      }}
                      className="pressable flex h-10 items-center justify-between rounded-lg bg-secondary px-3 text-sm"
                    >
                      <span>{shortName(c)}</span>
                      <span className="text-tiny text-muted-foreground">{c.sessionsLeft} зан.</span>
                    </button>
                  ))}
                <button type="button" onClick={() => setPick(false)} className="h-9 text-tiny text-muted-foreground">
                  свернуть
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPick(true)}
                className="pressable mt-3 h-11 w-full rounded-lg bg-ok text-sm font-medium text-ok-foreground"
              >
                Записать клиента
              </button>
            )
          ) : null}
          {closed ? (
            <button type="button" onClick={onOpen} className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm">
              Открыть слот
            </button>
          ) : people.length > 0 ? (
            pendingMass ? (
              <div className="mt-3 rounded-lg bg-primary-dim p-3">
                <p className="text-sm">Отменить {people.length} и уведомить клиентов? Слот закроется.</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button type="button" className="h-10 rounded-lg bg-secondary text-xs" onClick={onMassStart}>
                    Назад
                  </button>
                  <button type="button" className="h-10 rounded-lg bg-primary text-xs font-medium text-primary-foreground" onClick={onCancelAll}>
                    Отменить всех
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={onClose} className="pressable h-11 rounded-lg bg-secondary text-xs">
                  Скрыть слот
                </button>
                <button type="button" onClick={onMassStart} className="pressable h-11 rounded-lg bg-secondary text-xs text-primary">
                  Отменить всех
                </button>
              </div>
            )
          ) : (
            <button type="button" onClick={onClose} className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm">
              Закрыть слот
            </button>
          )}
        </div>
      ) : null}
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
