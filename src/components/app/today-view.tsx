import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/features";
import { confirmAction } from "@/lib/confirm";
import { useMemo, useState } from "react";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { PaymentsView } from "@/components/app/payments-view";
import { activeClient, useStudio } from "@/lib/studio-store";
import { KbjuMeters, SectionLabel, Surface } from "@/components/app/bits";
import { specialDataAllowed } from "@/lib/privacy";
import { balanceSummary } from "@/lib/balance-summary";
import { monthLabel, monthOf, revenueForMonth } from "@/lib/payments";
import { getTelegramUser, openTrainerChat } from "@/lib/telegram";
import { joinConfirmText, joinRejectText } from "@/lib/join-confirm";
import { TRAINER_TG_ID } from "@/data/studio";
import {
  daysSince,
  dayKbju,
  formatDayMonth,
  isoDate,
  isSlotPast,
  sessionsRu,
  sumFood,
  type Booking,
  type Client,
  type FoodLog,
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
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const checkIn = useStudio((s) => s.checkIn);
  const markNoShow = useStudio((s) => s.markNoShow);
  const setActiveClient = useStudio((s) => s.setActiveClient);
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);
  const showToast = useStudio((s) => s.showToast);
  const today = isoDate(new Date());
  const me = activeClient({ clients, activeClientId });
  const [showPayments, setShowPayments] = useState(false);

  /** занятия по клиентам тренера: остатки и пакеты, которые скоро закончатся */
  const balance = useMemo(() => balanceSummary(clients, today), [clients, today]);
  /** оплаты тренера за текущий месяц, BYN */
  const revenue = useMemo(() => revenueForMonth(clients, monthOf(today)), [clients, today]);

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

  if (role === "trainer" && showPayments) {
    return <PaymentsView clients={clients} initialMonth={monthOf(today)} onBack={() => setShowPayments(false)} />;
  }

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
            <p className="mt-1 text-tiny text-muted-foreground">Что требует внимания сегодня?</p>
          </div>
          <SyncStatusChip />
        </div>

        <div className="apple-block grid grid-cols-3 divide-x divide-border">
          <button type="button" className="pressable p-4 text-left" onClick={() => setTab("bookings")}>
            <p className="min-h-9 text-2xs text-muted-foreground">Ещё сегодня</p>
            <p className={"mt-1 font-display text-2xl tabular-nums leading-none"}>{upcomingToday.length}</p>
          </button>
          <div className="p-4">
            <p className="min-h-9 text-2xs text-muted-foreground">Без явки</p>
            <p className={cn("mt-1 font-display text-2xl tabular-nums leading-none", needMark.length > 0 && "text-alert-text")}>{needMark.length}</p>
          </div>
          <button type="button" className="pressable p-4 text-left" onClick={() => setTab("signals")}>
            <p className="min-h-9 text-2xs text-muted-foreground">Заявки</p>
            <p className={cn("mt-1 font-display text-2xl tabular-nums leading-none", pendingJoins.length > 0 && "text-alert-text")}>{pendingJoins.length}</p>
          </button>
        </div>

        {needMark.length > 0 ? (
          <div className="space-y-2">
            <p className="text-2xs font-medium tracking-wide text-muted-foreground ">
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
                      className="pressable rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-foreground"
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
                      onClick={async () => {
                        if (!await confirmAction(`Отметить неявку${name ? ` · ${name}` : ""}?`)) return;
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
            <p className="text-2xs font-medium tracking-wide text-muted-foreground ">
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
                    onClick={async () => {
                      if (await confirmAction(joinConfirmText(req))) approveJoin(req.id);
                    }}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="pressable h-11 rounded-xl bg-secondary text-sm"
                    onClick={async () => {
                      if (await confirmAction(joinRejectText(req))) rejectJoin(req.id);
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
            <p className="text-2xs font-medium tracking-wide text-muted-foreground ">
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
                  onClick={() => openClientSheet(c.id)}
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

        <button
          type="button"
          className="pressable h-11 w-full rounded-lg bg-secondary text-sm font-medium"
          onClick={() => setTab("signals")}
        >
          Сигналы и настройки →
        </button>

        <div className="space-y-2">
          <SectionLabel>Занятия</SectionLabel>
          <div className="apple-block grid grid-cols-3 divide-x divide-border">
            <button
              type="button"
              className="pressable p-4 text-left"
              onClick={() => {
                setClientFilter("all");
                setTab("clients");
              }}
            >
              <p className="min-h-9 text-2xs text-muted-foreground">На балансе, всего</p>
              <p className="mt-1 font-display text-2xl tabular-nums leading-none">{balance.prepaid}</p>
            </button>
            <button
              type="button"
              className="pressable p-4 text-left"
              onClick={() => {
                setClientFilter("packSoon");
                setTab("clients");
              }}
            >
              <p className="min-h-9 text-2xs text-muted-foreground">Пакет до 7 дн.</p>
              <p className={cn("mt-1 font-display text-2xl tabular-nums leading-none", balance.packsEndingSoon > 0 && "text-alert-text")}>
                {balance.packsEndingSoon}
              </p>
            </button>
            <button
              type="button"
              className="pressable p-4 text-left"
              onClick={() => {
                setClientFilter("empty");
                setTab("clients");
              }}
            >
              <p className="min-h-9 text-2xs text-muted-foreground">Без занятий</p>
              <p className={cn("mt-1 font-display text-2xl tabular-nums leading-none", balance.empty > 0 && "text-alert-text")}>
                {balance.empty}
              </p>
            </button>
          </div>
          {FEATURES.payments ? (
          <button type="button" className="apple-block pressable p-4 text-left" onClick={() => setShowPayments(true)}>
            <p className="text-2xs text-muted-foreground">Оплаты · {monthLabel(monthOf(today))}</p>
            <p className="mt-1 font-display text-2xl tabular-nums leading-none">
              {revenue.sum.toLocaleString("ru-RU")} <span className="text-base font-sans text-muted-foreground">BYN</span>
            </p>
            <p className="mt-1 text-tiny text-muted-foreground">{revenue.count} {revenue.count === 1 ? "оплата" : "оплат"} за месяц</p>
          </button>
          ) : null}
        </div>
      </div>
    );
  }

  const next = visit?.next;
  const isToday = next?.date === today;
  const afterSession = Boolean(visit?.todayDone && !next);
  // день визита: главное действие — тренировка; запись и питание вторичны
  const trainingFirst = isToday || afterSession;
  const lowPack = (me?.sessionsLeft ?? 0) <= 2;
  // no sessions left: booking is refused, so the button leads to the trainer instead
  const noBalance = Boolean(me) && (me?.sessionsLeft ?? 0) <= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <SectionLabel>Мой день</SectionLabel>
          <p className="mt-1 text-tiny text-muted-foreground">{me?.firstName ? `${me.firstName}, что` : "Что"} нужно сделать сегодня?</p>
        </div>
        <SyncStatusChip quietWhenOk />
      </div>

      {me ? (
        <Surface glow={lowPack ? "alert" : "ok"}>
          <p className="text-2xs tracking-wide text-muted-foreground ">Баланс</p>
          <p className="display-num mt-2">
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

      {me && specialDataAllowed(me.consent) ? (
        <TodayKbju client={me} food={food} bookings={bookings} today={today} />
      ) : null}

      <div className="space-y-2">
        <p className="text-2xs font-medium tracking-wide text-muted-foreground ">Запись</p>
        {next && isToday ? (
          <Surface>
            <p className="font-display text-xl leading-tight">Сегодня · {next.time}</p>
            <p className="mt-1 text-tiny text-muted-foreground">{next.duration} мин · слот подтверждён</p>
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
          <Surface glow={trainingFirst ? undefined : "alert"}>
            <p className="text-sm font-medium">{noBalance ? "Занятия закончились" : "Нет ближайшей записи"}</p>
            <p className="mt-1 text-tiny text-muted-foreground">
              {noBalance ? "Запись откроется после продления пакета. Напишите тренеру." : "Выберите слот — это первый шаг визита"}
            </p>
            <button
              type="button"
              className={`pressable mt-3 h-11 w-full rounded-lg text-sm font-medium ${
                trainingFirst ? "bg-secondary" : "bg-primary text-primary-foreground"
              }`}
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
        <p className="text-2xs font-medium tracking-wide text-muted-foreground ">Тренировка</p>
        {isToday || afterSession ? (
          <button type="button" className="pressable w-full text-left" onClick={() => setTab("program")}>
            <Surface glow="ok" className="border border-ok/30">
              <p className="text-2xs tracking-wide text-muted-foreground">
                {afterSession ? "После слота" : "Сейчас"}
              </p>
              <p className="mt-1 font-display text-lg leading-tight">
                {afterSession ? "Отметить подходы" : "Открыть программу"}
              </p>
              <p className="mt-1 text-tiny text-muted-foreground">
                Галочки и факты сохраняются и уходят на сервер
              </p>
              <p className="mt-3 text-xs font-medium text-foreground">К программе →</p>
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
        <p className="text-2xs font-medium tracking-wide text-muted-foreground ">Питание</p>
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
          <button
            type="button"
            className="pressable flex min-h-11 w-full items-center justify-between rounded-xl bg-secondary/50 px-4 py-3 text-left"
            onClick={() => setTab("food")}
          >
            <span>
              <span className="block text-sm">После зала · КБЖУ</span>
              <span className="block text-tiny text-muted-foreground">Короткий лог или конструктор меню</span>
            </span>
            <span className="ml-3 text-sm text-muted-foreground">→</span>
          </button>
        ) : (
          <button type="button" className="pressable w-full text-left" onClick={() => setTab("food")}>
            <Surface>
              <p className="font-display text-base leading-tight">Питание</p>
              <p className="mt-1 text-tiny text-muted-foreground">Дневник и КБЖУ за день</p>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Открыть питание →</p>
            </Surface>
          </button>
        )}
      </div>

      {visit?.gap != null && visit.gap >= 14 ? <SoftReturnPanel /> : null}
    </div>
  );
}

/** Кольца КБЖУ на главной клиента. Показываются только при согласии на данные о здоровье (как на вкладке «Еда»). */
function TodayKbju({
  client,
  food,
  bookings,
  today,
}: {
  client: Client;
  food: FoodLog[];
  bookings: Booking[];
  today: string;
}) {
  const todayFood = food.filter((f) => f.date === today && f.clientId === client.id);
  const goal = dayKbju(client, today, bookings);
  return (
    <Surface glow={goal.kbju.calories > 0 && sumFood(todayFood).calories < goal.kbju.calories * 0.72 ? "alert" : "ok"}>
      <KbjuMeters
        title={`Сегодня · ${goal.train ? "тренировка" : "отдых"}`}
        eaten={sumFood(todayFood)}
        target={goal.kbju}
      />
    </Surface>
  );
}
