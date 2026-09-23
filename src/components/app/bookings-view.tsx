import { useState } from "react";
import {
  countdownLabel,
  downloadIcs,
  bookingIcs,
  formatLongDate,
  parseISODate,
  STUDIO,
  hoursUntilSlot,
  isLateCancel,
  isSlotPast,
  sessionsRu,
  WEEK_GOAL,
  weekVisitCount,
} from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface, EmptyHint } from "@/components/app/bits";

function googleCalendarUrl(booking: { date: string; time: string; duration: number }, title = "Тренировка · Ruksha") {
  const [h, m] = booking.time.split(":").map(Number);
  const start = parseISODate(booking.date);
  start.setHours(h || 0, m || 0, 0, 0);
  const end = new Date(start.getTime() + booking.duration * 60000);
  const stamp = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  };
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${stamp(start)}/${stamp(end)}`,
    location: STUDIO.brand,
    details: "Ruksha Discipline",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export function BookingsView() {
  const all = useStudio((s) => s.bookings);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const cancelBooking = useStudio((s) => s.cancelBooking);
  const markNoShow = useStudio((s) => s.markNoShow);
  const setTab = useStudio((s) => s.setTab);
  const role = useStudio((s) => s.role);
  const notices = useStudio((s) => s.notices);
  const dismissed = useStudio((s) => s.dismissedSignalIds);
  const showToast = useStudio((s) => s.showToast);
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
    .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${b.time}`));
  const next = upcoming[0];
  const weekVisits = weekVisitCount(all, me?.id ?? "");
  const hoursToNext = next ? hoursUntilSlot(next.date, next.time) : null;

  if (role === "client" && !me) {
    return <EmptyHint>Записи появятся после того, как тренер добавит вас в зал.</EmptyHint>;
  }

  return (
    <div className="stagger-in flex flex-col gap-3">
      {role === "client" ? (
        <Surface glow={(me?.sessionsLeft ?? 0) <= 2 ? "alert" : "ok"}>
          <SectionLabel>Баланс занятий</SectionLabel>
          <p className="font-display mt-1 text-3xl tabular-nums">
            {me?.sessionsLeft ?? 0}
            <span className="ml-2 text-base font-sans font-normal text-muted-foreground">{sessionsRu(me?.sessionsLeft ?? 0)}</span>
          </p>
          <p className="mt-1 text-tiny text-muted-foreground">
            Отмена меньше чем за {notifyPrefs.windowHours} ч — занятие сгорает. Раньше — возвращается на баланс.
          </p>
          <div className="mt-3">
            <p className="text-tiny text-muted-foreground">
              Неделя · {weekVisits} из {WEEK_GOAL} визитов
            </p>
            <div className="mt-1.5 flex gap-1.5">
              {Array.from({ length: WEEK_GOAL }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < weekVisits ? "bg-ok" : "bg-secondary"}`}
                />
              ))}
            </div>
          </div>
        </Surface>
      ) : null}

      {role === "client" && next && hoursToNext !== null && hoursToNext < 24 && hoursToNext > 0 ? (
        <Surface glow="ok">
          <SectionLabel>Скоро тренировка</SectionLabel>
          <p className="font-display mt-1 text-xl">{next.time}</p>
          <p className="mt-1 text-tiny text-muted-foreground">
            {formatLongDate(next.date)} · {countdownLabel(next.date, next.time)}
          </p>
        </Surface>
      ) : null}

      {role === "client" && inbox.length > 0 ? (
        <Surface glow="alert">
          <SectionLabel>От тренера</SectionLabel>
          {inbox.slice(0, 3).map((n) => (
            <p key={n.id} className="mt-2 text-sm">
              {n.title}
              <span className="mt-0.5 block text-tiny text-muted-foreground">{n.body}</span>
            </p>
          ))}
        </Surface>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ближайших записей нет. Выберите время на вкладке «Слоты» — после тапа нужно подтверждение.
        </p>
      ) : null}

      {upcoming.map((booking) => {
        const who = clients.find((c) => c.id === booking.clientId);
        const pending = pendingId === booking.id;
        const late = isLateCancel(booking.date, booking.time, notifyPrefs.windowHours);
        return (
          <Surface key={booking.id} glow={pending ? "alert" : "ok"}>
            <p className="font-display text-lg font-semibold">{formatLongDate(booking.date)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {booking.time} · {booking.duration} мин
              {role === "trainer" && who ? ` · ${who.firstName}` : ""}
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
                      cancelBooking(booking.id, role);
                      setPendingId(null);
                    }}
                    className="pressable h-11 rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
                  >
                    Подтвердить
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
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
                      const url = googleCalendarUrl(booking);
                      try {
                        const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } }).Telegram?.WebApp;
                        if (tg?.openLink) tg.openLink(url);
                        else window.open(url, "_blank", "noopener,noreferrer");
                      } catch {
                        downloadIcs(`ruksha-${booking.date}.ics`, bookingIcs(booking));
                      }
                      showToast(`${booking.date} · ${booking.time}`);
                    }}
                    className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                  >
                    В календарь
                  </button>
                ) : null}
              </div>
            )}
          </Surface>
        );
      })}

      {past.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          <SectionLabel>Прошедшие</SectionLabel>
          {past.map((booking) => (
            <Surface key={booking.id} className="opacity-80">
              <p className="font-display text-base font-semibold">{formatLongDate(booking.date)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {booking.time} · {booking.duration} мин
                {booking.checkedIn ? " · чек-ин" : booking.noShow ? " · неявка" : ""}
              </p>
              {role === "trainer" && !booking.checkedIn && !booking.noShow ? (
                <button
                  type="button"
                  onClick={() => markNoShow(booking.id)}
                  className="pressable mt-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                >
                  Отметить неявку
                </button>
              ) : null}
            </Surface>
          ))}
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
