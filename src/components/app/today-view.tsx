import { useMemo } from "react";
import { ActionCenter } from "@/components/app/action-center";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { BookingsView } from "@/components/app/bookings-view";
import { activeClient, useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import {
  daysSince,
  formatDayMonth,
  isoDate,
  isSlotPast,
  sessionsRu,
} from "@/data/studio";
import { SyncStatusChip } from "@/components/app/sync-status";

/**
 * Блок A · Мой день
 * Клиент: один поток визита (запись → программа → еда)
 * Тренер: сводка зала + центр действий + записи
 */
export function TodayView() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const joinRequests = useStudio((s) => s.joinRequests);
  const food = useStudio((s) => s.food);
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

  const visit = useMemo(() => {
    if (!me) return null;
    const mine = bookings.filter((b) => b.clientId === me.id && !b.noShow);
    const upcoming = mine
      .filter((b) => !isSlotPast(b.date, b.time))
      .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`));
    const next = upcoming[0] ?? null;
    const todayDone = mine
      .filter((b) => b.date === today && isSlotPast(b.date, b.time))
      .sort((a, b) => b.time.localeCompare(a.time))[0];
    const eatenToday = food.some((f) => f.clientId === me.id && f.date === today);
    const lastPast = mine
      .filter((b) => isSlotPast(b.date, b.time))
      .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`))[0];
    const gap = lastPast ? daysSince(lastPast.date, today) : null;
    return { next, todayDone, eatenToday, gap };
  }, [me, bookings, food, today]);

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

  const next = visit?.next;
  const isToday = next?.date === today;
  const afterSession = Boolean(visit?.todayDone && !next);
  const lowPack = (me?.sessionsLeft ?? 0) <= 2;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <SectionLabel>Мой день</SectionLabel>
          <p className="mt-1 text-tiny text-muted-foreground">Запись · тренировка · еда</p>
        </div>
        <SyncStatusChip />
      </div>

      {me ? (
        <Surface glow={lowPack ? "alert" : "ok"}>
          <p className="text-2xs tracking-wide text-muted-foreground uppercase">Баланс</p>
          <p className="mt-1 font-display text-2xl tabular-nums leading-none">
            {me.sessionsLeft ?? 0}
            <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
              {sessionsRu(me.sessionsLeft ?? 0)}
            </span>
          </p>
          {me.programTitle ? (
            <p className="mt-1.5 text-tiny text-muted-foreground">{me.programTitle}</p>
          ) : null}
        </Surface>
      ) : (
        <Surface>
          <p className="text-sm text-muted-foreground">Тренер ещё не добавил вас в зал.</p>
        </Surface>
      )}

      <div className="space-y-2">
        <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">1 · Запись</p>
        {next && isToday ? (
          <Surface glow="ok">
            <p className="font-display text-xl leading-tight">Сегодня · {next.time}</p>
            <p className="mt-1 text-tiny text-muted-foreground">{next.duration} мин · слот подтверждён</p>
            <button
              type="button"
              className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm font-medium"
              onClick={() => setTab("schedule")}
            >
              К записи
            </button>
          </Surface>
        ) : next ? (
          <Surface>
            <p className="font-display text-xl leading-tight">
              {formatDayMonth(next.date)} · {next.time}
            </p>
            <p className="mt-1 text-tiny text-muted-foreground">Ближайшая запись · {next.duration} мин</p>
            <button
              type="button"
              className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm font-medium"
              onClick={() => setTab("schedule")}
            >
              К записи
            </button>
          </Surface>
        ) : (
          <Surface glow="alert">
            <p className="text-sm font-medium">Нет ближайшей записи</p>
            <p className="mt-1 text-tiny text-muted-foreground">Выберите слот — это первый шаг визита</p>
            <button
              type="button"
              className="pressable mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => setTab("schedule")}
            >
              Записаться
            </button>
          </Surface>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">2 · Тренировка</p>
        {isToday || afterSession ? (
          <button type="button" className="pressable w-full text-left" onClick={() => setTab("program")}>
            <Surface glow="ok" className="border border-ok/30">
              <p className="text-2xs tracking-wide text-ok uppercase">
                {afterSession ? "После слота" : "Сейчас"}
              </p>
              <p className="mt-1 font-display text-lg leading-tight">
                {afterSession ? "Отметить подходы" : "Открыть программу"}
              </p>
              <p className="mt-1 text-tiny text-muted-foreground">
                Галочки и факты сохраняются и уходят на сервер
              </p>
              <p className="mt-3 text-xs font-medium text-ok">К программе →</p>
            </Surface>
          </button>
        ) : (
          <Surface className="opacity-80">
            <p className="text-sm text-muted-foreground">
              {next
                ? "Программа откроется в день тренировки"
                : "Сначала запись — потом план на день"}
            </p>
            {me?.sessions?.length ? (
              <button
                type="button"
                className="pressable mt-3 h-10 rounded-lg bg-secondary px-3 text-xs font-medium"
                onClick={() => setTab("program")}
              >
                Посмотреть программу
              </button>
            ) : null}
          </Surface>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">3 · Еда</p>
        {visit?.eatenToday ? (
          <Surface>
            <p className="text-sm">Сегодня уже есть запись по еде</p>
            <button
              type="button"
              className="pressable mt-3 h-10 rounded-lg bg-secondary px-3 text-xs font-medium"
              onClick={() => setTab("food")}
            >
              К еде
            </button>
          </Surface>
        ) : isToday || afterSession ? (
          <button type="button" className="pressable w-full text-left" onClick={() => setTab("food")}>
            <Surface>
              <p className="font-display text-base leading-tight">После зала · КБЖУ</p>
              <p className="mt-1 text-tiny text-muted-foreground">Короткий лог или конструктор меню</p>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Открыть еду →</p>
            </Surface>
          </button>
        ) : (
          <Surface className="opacity-80">
            <p className="text-sm text-muted-foreground">В день визита здесь появится быстрый вход в еду</p>
          </Surface>
        )}
      </div>

      {visit?.gap != null && visit.gap >= 14 ? <SoftReturnPanel /> : null}
    </div>
  );
}
