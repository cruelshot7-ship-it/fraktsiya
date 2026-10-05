import { useMemo } from "react";
import { ActionCenter } from "@/components/app/action-center";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { ProgramView } from "@/components/app/program-view";
import { BookingsView } from "@/components/app/bookings-view";
import { useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { daysSince, isoDate, isSlotPast } from "@/data/studio";

/**
 * Блок A · Мой день
 * Клиент: задачи + программа сегодня
 * Тренер: сводка зала + центр действий + записи
 */
export function TodayView() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const joinRequests = useStudio((s) => s.joinRequests);
  const setTab = useStudio((s) => s.setTab);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const today = isoDate(new Date());

  const summary = useMemo(() => {
    const todayRows = bookings.filter((b) => b.date === today && !b.noShow);
    const upcoming = todayRows
      .filter((b) => !isSlotPast(b.date, b.time))
      .sort((a, b) => a.time.localeCompare(b.time));
    const needMark = todayRows.filter(
      (b) => isSlotPast(b.date, b.time) && !b.checkedIn && !b.noShow,
    );
    const lowPack = clients.filter((c) => (c.sessionsLeft ?? 0) <= 2).length;
    const silent = clients.filter((c) => daysSince(c.lastReportAt, today) >= 7).length;
    const joins = joinRequests.filter((r) => r.status === "pending").length;
    return {
      todayCount: todayRows.length,
      nextTime: upcoming[0]?.time ?? null,
      needMark: needMark.length,
      lowPack,
      silent,
      joins,
    };
  }, [bookings, clients, joinRequests, today]);

  if (role === "trainer") {
    return (
      <div className="space-y-4">
        <div>
          <SectionLabel>Сегодня</SectionLabel>
          <p className="mt-1 text-tiny text-muted-foreground">Сводка зала · задачи · записи</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="pressable text-left" onClick={() => setTab("bookings")}>
            <Surface glow={summary.todayCount ? "ok" : undefined} className="h-full">
              <p className="text-2xs tracking-wide text-muted-foreground uppercase">Записей сегодня</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">{summary.todayCount}</p>
              <p className="mt-1.5 text-tiny text-muted-foreground">
                {summary.nextTime ? `ближайшая ${summary.nextTime}` : "нет окон"}
              </p>
            </Surface>
          </button>

          <button type="button" className="pressable text-left" onClick={() => setTab("bookings")}>
            <Surface glow={summary.needMark ? "alert" : undefined} className="h-full">
              <p className="text-2xs tracking-wide text-muted-foreground uppercase">Без отметки</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">{summary.needMark}</p>
              <p className="mt-1.5 text-tiny text-muted-foreground">явка после слота</p>
            </Surface>
          </button>

          <button
            type="button"
            className="pressable text-left"
            onClick={() => {
              setClientFilter("attention");
              setTab("clients");
            }}
          >
            <Surface glow={summary.lowPack || summary.silent ? "alert" : undefined} className="h-full">
              <p className="text-2xs tracking-wide text-muted-foreground uppercase">Внимание</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">
                {summary.lowPack + summary.silent}
              </p>
              <p className="mt-1.5 text-tiny text-muted-foreground">мало занятий · тишина 7д</p>
            </Surface>
          </button>

          <button type="button" className="pressable text-left" onClick={() => setTab("signals")}>
            <Surface glow={summary.joins ? "alert" : undefined} className="h-full">
              <p className="text-2xs tracking-wide text-muted-foreground uppercase">Заявки</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">{summary.joins}</p>
              <p className="mt-1.5 text-tiny text-muted-foreground">в зал · pending</p>
            </Surface>
          </button>
        </div>

        <ActionCenter />
        <BookingsView />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Мой день</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">Что сделать сейчас · программа · прогресс</p>
      </div>
      <SoftReturnPanel />
      <ActionCenter />
      <ProgramView />
    </div>
  );
}
