import { useState } from "react";
import {
  addDays,
  DOW,
  isoDate,
  isFrozen,
  isSlotPast,
  parseISODate,
  shortName,
  startOfWeek,
} from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { Field, inputClass } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { BOT_USERNAME } from "@/data/studio";
import { openTelegramUrl } from "@/lib/telegram";

const SLOT_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "16:30", "19:00"];

export function TrainerSlots() {
  const selectedDate = useStudio((s) => s.selectedDate);
  const weekStart = useStudio((s) => s.weekStart);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const clients = useStudio((s) => s.clients);
  const shiftWeek = useStudio((s) => s.shiftWeek);
  const selectDay = useStudio((s) => s.selectDay);
  const addSlot = useStudio((s) => s.addSlot);
  const showToast = useStudio((s) => s.showToast);
  const closeSlot = useStudio((s) => s.closeSlot);
  const cancelSlotBookings = useStudio((s) => s.cancelSlotBookings);
  const bookSlot = useStudio((s) => s.bookSlot);
  const cancelBooking = useStudio((s) => s.cancelBooking);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [time, setTime] = useState("18:00");
  const [cap, setCap] = useState("3");
  const [pickId, setPickId] = useState<string | null>(null);

  const start = startOfWeek(parseISODate(weekStart));
  const minWeek = isoDate(start);
  const canPrev = weekStart > minWeek;
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = isoDate(date);
    const daySlots = slots.filter((s) => s.date === key && !closedSlotIds.includes(s.id));
    return {
      key,
      date,
      booked: bookings.filter((b) => b.date === key).length,
      total: daySlots.length,
    };
  });

  const daySlots = slots
    .filter((s) => s.date === selectedDate && !closedSlotIds.includes(s.id))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div>
      <div className="flex items-center justify-between pt-1 pb-2.5">
        <button type="button" disabled={!canPrev} onClick={() => shiftWeek(-1)} className="grid size-8 place-items-center rounded-lg bg-card text-base shadow-border disabled:opacity-30">
          ‹
        </button>
        <p className="font-display text-sm tracking-[0.06em] text-muted-foreground uppercase">Слоты зала</p>
        <button type="button" onClick={() => shiftWeek(1)} className="grid size-8 place-items-center rounded-lg bg-card text-base shadow-border">
          ›
        </button>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pt-1 pb-4">
        {days.map((day, i) => {
          const selected = selectedDate === day.key;
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => {
                selectDay(day.key);
                setOpenId(null);
              }}
              className={cn("min-w-11 flex-1 rounded-xl px-1 py-2 text-center shadow-border", selected ? "glow-ok bg-ok-dim" : "bg-card")}
            >
              <span className="block text-2xs tracking-wide text-muted-foreground">{DOW[i]}</span>
              <span className="font-display mt-0.5 block text-lg leading-none font-semibold">{day.date.getDate()}</span>
              <span className="mt-0.5 block text-3xs text-muted-foreground">{day.total === 0 ? "—" : `${day.booked} зап.`}</span>
            </button>
          );
        })}
      </div>

      <div className="stagger-in flex flex-col gap-2">
        {daySlots.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">На этот день слотов нет. Добавьте время ниже.</p>
        ) : (
          daySlots.map((slot) => {
            const taken = slotTaken(slot, bookings);
            const people = bookings
              .filter((b) => b.slotId === slot.id)
              .map((b) => ({ booking: b, client: clients.find((c) => c.id === b.clientId) }))
              .filter((x) => x.client);
            const expanded = openId === slot.id;
            return (
              <div key={slot.id} className="overflow-hidden rounded-xl bg-card shadow-border">
                <button type="button" onClick={() => setOpenId(expanded ? null : slot.id)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
                  <span className="w-16 shrink-0 font-display text-xl font-semibold leading-none">{slot.time}</span>
                  <span className="min-w-0 flex-1 truncate text-tiny text-muted-foreground">
                    {people.map((p) => p.client && shortName(p.client)).filter(Boolean).join(" · ") || "пусто"}
                  </span>
                  <span className="text-tiny text-muted-foreground">{taken}/{slot.capacity}</span>
                </button>
                {expanded ? (
                  <div className="border-t border-hairline px-4 py-3">
                    {people.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Никто не записан.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {people.map(({ booking, client }) =>
                          client ? (
                            <div key={booking.id} className="flex items-center justify-between gap-2">
                              <p className="text-sm">{shortName(client)}</p>
                              <button type="button" className="text-tiny text-primary" onClick={() => cancelBooking(booking.id, "trainer")}>
                                Снять
                              </button>
                            </div>
                          ) : null,
                        )}
                      </div>
                    )}
                    {pickId === slot.id ? (
                      <div className="mt-3 flex flex-col gap-1.5">
                        {clients
                          .filter((c) => !people.some((p) => p.client?.id === c.id) && (c.sessionsLeft ?? 0) > 0 && !isFrozen(c))
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                const ok = bookSlot(slot.id, c.id);
                                setPickId(null);
                                if (ok) {
                                  const link = `https://t.me/${BOT_USERNAME}`;
                                  if (c.telegramUsername) {
                                    openTelegramUrl(
                                      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Запись ${slot.time} · ${link}`)}`,
                                    );
                                  }
                                }
                              }}
                              className="pressable flex h-10 items-center justify-between rounded-lg bg-secondary px-3 text-sm"
                            >
                              <span>{shortName(c)}</span>
                              <span className="text-tiny text-muted-foreground">{c.sessionsLeft} зан.</span>
                            </button>
                          ))}
                        <button type="button" onClick={() => setPickId(null)} className="h-9 text-tiny text-muted-foreground">
                          свернуть
                        </button>
                      </div>
                    ) : taken < slot.capacity && !isSlotPast(slot.date, slot.time) ? (
                      <button type="button" onClick={() => setPickId(slot.id)} className="pressable mt-3 h-11 w-full rounded-lg bg-ok text-sm font-medium text-ok-foreground">
                        Записать клиента
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        cancelSlotBookings(slot.id);
                        closeSlot(slot.id);
                        setOpenId(null);
                      }}
                      className="pressable mt-2 h-11 w-full rounded-lg bg-primary-dim text-sm text-primary"
                    >
                      Удалить слот
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {adding ? (
        <div className="mt-3 rounded-xl bg-card p-4 shadow-border">
          <p className="font-display text-xs tracking-[0.08em] text-muted-foreground uppercase">Новый слот</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SLOT_TIMES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={cn(
                  "h-9 rounded-lg px-2.5 text-xs font-medium",
                  time === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Время">
              <input className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} placeholder="18:00" inputMode="numeric" />
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
                const hhmm = /^\d{1,2}:\d{2}$/.test(time.trim()) ? time.trim().padStart(5, "0") : "";
                if (!hhmm || !capacity) {
                  showToast("Укажите время и число мест.");
                  return;
                }
                addSlot(selectedDate, hhmm, capacity);
                setAdding(false);
              }}
            >
              Добавить
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="pressable mt-3 h-12 w-full rounded-xl bg-card text-sm shadow-border">
          Добавить слот
        </button>
      )}
    </div>
  );
}
