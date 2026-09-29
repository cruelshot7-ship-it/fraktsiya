import { useState } from "react";
import {
  countdownLabel,
  formatLongDate,
  hoursUntilSlot,
  isLateCancel,
  isSlotPast,
  relativeDayLabel,
  sessionsRu,
  shortName,
  WEEK_GOAL,
  weekVisitCount,
} from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { suggestNextSlot } from "@/lib/next-slot";
import { openCalendarEvent } from "@/lib/calendar-ics";
import { SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { ActionCenter } from "@/components/app/action-center";
import { SessionCard } from "@/components/app/session-card";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { NotifyPrefsPanel } from "@/components/app/notify-prefs-panel";
import { DecisionBanner } from "@/components/app/decision-banner";

export function BookingsView() {
  const all = useStudio((s) => s.bookings);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const cancelBooking = useStudio((s) => s.cancelBooking);
  const markNoShow = useStudio((s) => s.markNoShow);
  const setTab = useStudio((s) => s.setTab);
  const role = useStudio((s) => s.role);
  const slots = useStudio((s) => s.slots);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const bookSlot = useStudio((s) => s.book);
  const notices = useStudio((s) => s.notices);
  const dismissed = useStudio((s) => s.dismissedSignalIds);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const me = activeClient({ clients, activeClientId });
  const bookings = role === "trainer" ? all : all.filter((b) => b.clientId === me?.id);
  const inbox = notices.filter((n) => n.audience === "client" && n.clientId === me?.id && !dismissed.includes(n.id));
  const [pendingId, setPendingId] = useState<string | null>(null);
  const upcoming = bookings
    .filter((b) => !isSlotPast(b.date, b.time))
    .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`));
  const past = bookings
    .filter((b) => isSlotPast(b.date, b.time))
    .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
  const next = upcoming[0];
  const weekVisits = weekVisitCount(all, me?.id ?? "");
  const hoursToNext = next ? hoursUntilSlot(next.date, next.time) : null;

  if (role === "client" && !me) {
    return <EmptyHint>Записи появятся после того, как тренер добавит вас в зал.</EmptyHint>;
  }

  return (
    <div className="stagger-in flex flex-col gap-3">
      <ActionCenter />
      {role === "client" ? <SoftReturnPanel /> : null}
      {role === "client" ? <DecisionBanner /> : null}
      {role === "client" ? <NotifyPrefsPanel /> : null}
      {next ? <SessionCard bookingId={next.id} /> : null}
      {role === "client" ? (
        <Surface glow={next ? "ok" : undefined}>
          <SectionLabel>Ближайшая запись</SectionLabel>
          {next ? (
            <>
              <p className="font-display mt-2 text-xl">{next.time}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatLongDate(next.date)} · {countdownLabel(next.date, next.time)}
              </p>
              <p className="mt-2 text-tiny text-muted-foreground">
                Неделя · {weekVisits} из {WEEK_GOAL}
                {hoursToNext !== null && hoursToNext > 0 && hoursToNext < 24
                  ? ` · через ${Math.round(hoursToNext)} ч`
                  : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Пока пусто — выберите слот.</p>
          )}
        </Surface>
      ) : null}

      {inbox.length > 0 ? (
        <Surface>
          <SectionLabel>Сообщения</SectionLabel>
          <ul className="mt-2 space-y-2">
            {inbox.slice(0, 5).map((n) => (
              <li key={n.id} className="text-sm">
                <span className="font-medium">{n.title}</span>
                <span className="text-muted-foreground"> · {n.body}</span>
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      {role === "client" && !upcoming.length ? (
        <p className="text-sm text-muted-foreground">
          Ближайших записей нет. Выберите время на вкладке «Слоты».
        </p>
      ) : null}

      {role === "client" && me && next
        ? (() => {
            const suggestion = suggestNextSlot({
              slots,
              bookings: all,
              clientId: me.id,
              closedSlotIds,
              afterDate: next.date,
              afterTime: next.time,
              coachId: me.coachId,
            });
            if (!suggestion) return null;
            return (
              <Surface>
                <SectionLabel>Следующий шаг</SectionLabel>
                <p className="mt-2 text-sm">{suggestion.reason}</p>
                <button
                  type="button"
                  className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                  onClick={() => {
                    const ok = bookSlot(suggestion.slot.id);
                    if (ok) setTab("bookings");
                  }}
                >
                  Записаться · {suggestion.slot.time}
                </button>
              </Surface>
            );
          })()
        : null}

      {(() => {
        const groups: { date: string; items: typeof upcoming }[] = [];
        for (const booking of upcoming) {
          const last = groups.at(-1);
          if (!last || last.date !== booking.date) groups.push({ date: booking.date, items: [booking] });
          else last.items.push(booking);
        }
        return groups.map((group) => (
          <div key={group.date} className="flex flex-col gap-2">
            <SectionLabel>{relativeDayLabel(group.date)}</SectionLabel>
            {group.items.map((booking) => {
              const who = clients.find((c) => c.id === booking.clientId);
              const pending = pendingId === booking.id;
              const late = isLateCancel(booking.date, booking.time, notifyPrefs.windowHours);
              return (
                <Surface key={booking.id} glow={pending ? "alert" : "ok"}>
                  <p className="font-display text-lg font-semibold">{booking.time}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatLongDate(booking.date)} · {booking.duration} мин
                    {role === "trainer" && who ? ` · ${shortName(who)}` : ""}
                    {booking.checkedIn ? " · в зале" : ""}
                    {role === "client" ? ` · ${countdownLabel(booking.date, booking.time)}` : ""}
                  </p>
                  {pending ? (
                    <div className="mt-3 border-t border-primary/30 pt-3">
                      <p className="text-sm">
                        {role === "trainer"
                          ? "Отменить и вернуть занятие клиенту?"
                          : late
                            ? `До тренировки меньше ${notifyPrefs.windowHours} ч. Занятие будет списано.`
                            : "Занятие вернётся на баланс. Тренер получит уведомление."}
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
                            const client = clients.find((c) => c.id === booking.clientId);
                            cancelBooking(booking.id, role);
                            void import("@/lib/notify/hook-booking").then(({ enqueueBookingCancelled }) => {
                              enqueueBookingCancelled({
                                telegramId: client?.telegramId,
                                bookingId: booking.id,
                                clientId: booking.clientId,
                              });
                            });
                            setPendingId(null);
                          }}
                          className="pressable h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                        >
                          Подтвердить
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingId(booking.id)}
                        className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                      >
                        {role === "trainer" ? "Отменить · вернуть занятие" : "Отменить запись"}
                      </button>
                      {role === "client" ? (
                        <button
                          type="button"
                          onClick={() => {
                            openCalendarEvent({
                              id: booking.id,
                              title: "Тренировка · Ruksha",
                              date: booking.date,
                              time: booking.time,
                              durationMin: booking.duration || 60,
                              timezone: "Europe/Minsk",
                            });
                          }}
                          className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                        >
                          В календарь
                        </button>
                      ) : null}
                      {role === "trainer" && !booking.checkedIn && !booking.noShow ? (
                        <button
                          type="button"
                          onClick={() => markNoShow(booking.id)}
                          className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                        >
                          Неявка
                        </button>
                      ) : null}
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        ));
      })()}

      {past.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          <SectionLabel>Прошедшие</SectionLabel>
          {past.slice(0, 8).map((booking) => {
            const who = clients.find((c) => c.id === booking.clientId);
            return (
              <Surface key={booking.id}>
                <p className="text-sm">
                  {booking.time} · {formatLongDate(booking.date)}
                  {role === "trainer" && who ? ` · ${shortName(who)}` : ""}
                  {booking.noShow ? " · неявка" : booking.checkedIn ? " · был" : ""}
                </p>
              </Surface>
            );
          })}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setTab("slots")}
        className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        К слотам
      </button>
    </div>
  );
}
