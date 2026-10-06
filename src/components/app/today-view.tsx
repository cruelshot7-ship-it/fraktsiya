import { useMemo } from "react";
import { ActionCenter } from "@/components/app/action-center";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { BookingsView } from "@/components/app/bookings-view";
import { activeClient, useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { daysSince, isoDate, isSlotPast } from "@/data/studio";
import { clientActionItems } from "@/lib/action-items";

/**
 * Блок A · Мой день
 * Клиент: один главный CTA + мягкий возврат + задачи
 * Тренер: сводка зала + центр действий + записи
 */
export function TodayView() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const joinRequests = useStudio((s) => s.joinRequests);
  const slots = useStudio((s) => s.slots);
  const notices = useStudio((s) => s.notices);
  const activeClientId = useStudio((s) => s.activeClientId);
  const setTab = useStudio((s) => s.setTab);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const today = isoDate(new Date());
  const me = activeClient({ clients, activeClientId });

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

  const primary = useMemo(() => {
    if (!me || role === "trainer") return null;
    const items = clientActionItems({ client: me, bookings, slots, notices });
    return items.sort((a, b) => a.priority - b.priority)[0] ?? null;
  }, [me, role, bookings, slots, notices]);

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
        <p className="mt-1 text-tiny text-muted-foreground">Одно главное действие · дальше по желанию</p>
      </div>

      {primary ? (
        <button type="button" className="pressable w-full text-left" onClick={() => setTab(primary.tab)}>
          <Surface glow="ok" className="border border-ok/30">
            <p className="text-2xs tracking-wide text-ok uppercase">Сейчас</p>
            <p className="mt-1 font-display text-xl leading-tight">{primary.title}</p>
            <p className="mt-1.5 text-tiny text-muted-foreground">{primary.body}</p>
            <p className="mt-3 text-xs font-medium text-ok">Открыть →</p>
          </Surface>
        </button>
      ) : (
        <Surface>
          <p className="text-sm text-muted-foreground">Нет срочных задач. Можно записаться или открыть программу.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="pressable h-11 rounded-lg bg-secondary text-sm"
              onClick={() => setTab("schedule")}
            >
              Запись
            </button>
            <button
              type="button"
              className="pressable h-11 rounded-lg bg-secondary text-sm"
              onClick={() => setTab("program")}
            >
              Программа
            </button>
          </div>
        </Surface>
      )}

      <SoftReturnPanel />
      <ActionCenter />
    </div>
  );
}
