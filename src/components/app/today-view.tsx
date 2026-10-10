import { useMemo } from "react";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { activeClient, useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { getTelegramUser, openTrainerChat } from "@/lib/telegram";
import { joinConfirmText, joinRejectText } from "@/lib/join-confirm";
import { TRAINER_TG_ID } from "@/data/studio";
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
 * Тренер: inbox смены (явка · заявки · внимание)
 */
export function TodayView() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const joinRequests = useStudio((s) => s.joinRequests);
  const food = useStudio((s) => s.food);
  const activeClientId = useStudio((s) => s.activeClientId);
  const setTab = useStudio((s) => s.setTab);
  const trainerUsername = useStudio((s) => s.trainerUsername);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const checkIn = useStudio((s) => s.checkIn);
  const markNoShow = useStudio((s) => s.markNoShow);
  const setActiveClient = useStudio((s) => s.setActiveClient);
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);
  const showToast = useStudio((s) => s.showToast);
  const today = isoDate(new Date());
  const me = activeClient({ clients, activeClientId });

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
    const todayRows = bookings
      .filter((b) => b.date === today && !b.noShow)
      .sort((a, b) => a.time.localeCompare(b.time));
    const needMark = todayRows.filter(
      (b) => isSlotPast(b.date, b.time) && !b.checkedIn && !b.noShow,
    );
    const upcomingToday = todayRows.filter((b) => !isSlotPast(b.date, b.time));
    // a request addressed to another trainer is not this trainer's to approve
    const myTgId = String(getTelegramUser()?.id ?? TRAINER_TG_ID);
    const pendingJoins = joinRequests.filter((r) => r.status === "pending" && (!r.coachId || r.coachId === myTgId));
    const attention = clients.filter((c) => {
      const low = (c.sessionsLeft ?? 0) <= 2;
      const silent = daysSince(c.lastReportAt, today) >= 7;
      return low || silent;
    });

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <SectionLabel>Смена</SectionLabel>
            <p className="mt-1 text-tiny text-muted-foreground">Явка · заявки · внимание</p>
          </div>
          <SyncStatusChip />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="pressable text-left" onClick={() => setTab("bookings")}>
            <Surface glow={upcomingToday.length ? "ok" : undefined} className="h-full">
              <p className="text-2xs tracking-wide text-muted-foreground uppercase">Ещё сегодня</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">{upcomingToday.length}</p>
            </Surface>
          </button>
          <Surface glow={needMark.length ? "alert" : undefined} className="h-full">
            <p className="text-2xs tracking-wide text-muted-foreground uppercase">Без явки</p>
            <p className="mt-1 font-display text-2xl tabular-nums leading-none">{needMark.length}</p>
          </Surface>
          <button type="button" className="pressable text-left" onClick={() => setTab("signals")}>
            <Surface glow={pendingJoins.length ? "alert" : undefined} className="h-full">
              <p className="text-2xs tracking-wide text-muted-foreground uppercase">Заявки</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">{pendingJoins.length}</p>
            </Surface>
          </button>
        </div>

        {needMark.length > 0 ? (
          <div className="space-y-2">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Отметить явку · {needMark.length}
            </p>
            {needMark.map((b) => {
              const who = clients.find((c) => c.id === b.clientId);
              const name = who ? `${who.firstName} ${who.lastName ?? ""}`.trim() : "";
              return (
                <Surface key={b.id} glow="alert">
                  <p className="font-display text-base leading-tight">
                    {b.time}
                    {name ? ` · ${name}` : ""}
                  </p>
                  <p className="mt-0.5 text-tiny text-muted-foreground">слот прошёл · нет отметки</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="pressable rounded-lg bg-ok/15 px-3 py-2 text-xs font-medium text-ok"
                      onClick={() => {
                        checkIn(b.id);
                        showToast(name ? `Явка · ${name}` : "Явка отмечена");
                      }}
                    >
                      Явка
                    </button>
                    <button
                      type="button"
                      className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                      onClick={() => {
                        if (!window.confirm(`Отметить неявку${name ? ` · ${name}` : ""}?`)) return;
                        markNoShow(b.id);
                        showToast(name ? `Неявка · ${name}` : "Неявка отмечена");
                      }}
                    >
                      Неявка
                    </button>
                    <button
                      type="button"
                      className="pressable rounded-lg bg-secondary px-3 py-2 text-xs font-medium"
                      onClick={() => {
                        setActiveClient(b.clientId);
                        setTab("program");
                      }}
                    >
                      Программа
                    </button>
                  </div>
                </Surface>
              );
            })}
          </div>
        ) : null}

        {pendingJoins.length > 0 ? (
          <div className="space-y-2">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Заявки в зал · {pendingJoins.length}
            </p>
            {pendingJoins.slice(0, 5).map((req) => (
              <Surface key={req.id} glow="ok">
                <p className="font-display text-base">
                  {req.firstName} {req.lastName}
                </p>
                {req.telegramUsername ? (
                  <p className="text-tiny text-muted-foreground">@{req.telegramUsername}</p>
                ) : null}
                <p className="mt-1 text-sm text-muted-foreground">{req.message || "Заявка в зал"}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                    onClick={() => {
                      if (window.confirm(joinConfirmText(req))) approveJoin(req.id);
                    }}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="pressable h-11 rounded-xl bg-secondary text-sm"
                    onClick={() => {
                      if (window.confirm(joinRejectText(req))) rejectJoin(req.id);
                    }}
                  >
                    Отклонить
                  </button>
                </div>
              </Surface>
            ))}
          </div>
        ) : null}

        {attention.length > 0 ? (
          <div className="space-y-2">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">
              Внимание · {attention.length}
            </p>
            {attention.slice(0, 5).map((c) => {
              const low = (c.sessionsLeft ?? 0) <= 2;
              const silent = daysSince(c.lastReportAt, today) >= 7;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="pressable w-full text-left"
                  onClick={() => {
                    setClientFilter("attention");
                    setTab("clients");
                  }}
                >
                  <Surface>
                    <p className="text-sm font-medium">
                      {c.firstName} {c.lastName}
                    </p>
                    <p className="mt-0.5 text-tiny text-muted-foreground">
                      {[low ? `мало занятий · ${c.sessionsLeft ?? 0}` : null, silent ? "тишина 7+ дн" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Surface>
                </button>
              );
            })}
          </div>
        ) : null}

        {needMark.length === 0 && pendingJoins.length === 0 && attention.length === 0 ? (
          <Surface>
            <p className="text-sm text-muted-foreground">Открытых задач смены нет. Можно смотреть записи.</p>
            <button
              type="button"
              className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm font-medium"
              onClick={() => setTab("bookings")}
            >
              Все записи
            </button>
          </Surface>
        ) : (
          <button
            type="button"
            className="pressable h-11 w-full rounded-lg bg-secondary text-sm font-medium"
            onClick={() => setTab("bookings")}
          >
            Все записи списком
          </button>
        )}
      </div>
    );
  }

  const next = visit?.next;
  const isToday = next?.date === today;
  const afterSession = Boolean(visit?.todayDone && !next);
  const lowPack = (me?.sessionsLeft ?? 0) <= 2;
  // no sessions left: booking is refused, so the button leads to the trainer instead
  const noBalance = Boolean(me) && (me?.sessionsLeft ?? 0) <= 0;

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
            <p className="text-sm font-medium">{noBalance ? "Занятия закончились" : "Нет ближайшей записи"}</p>
            <p className="mt-1 text-tiny text-muted-foreground">
              {noBalance ? "Запись откроется после продления пакета. Напишите тренеру." : "Выберите слот — это первый шаг визита"}
            </p>
            <button
              type="button"
              className="pressable mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => {
                if (!noBalance) {
                  setTab("schedule");
                  return;
                }
                if (!openTrainerChat(trainerUsername)) showToast("Тренер не указал @ник. Напишите ему в зал.");
              }}
            >
              {noBalance ? "Написать тренеру" : "Записаться"}
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
              {next ? "Программа откроется в день тренировки" : "Сначала запись — потом план на день"}
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
