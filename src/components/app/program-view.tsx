import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  countdownLabel,
  dayRitual,
  dayKbju,
  DOW,
  dowIndex,
  formatDayMonth,
  hoursUntilSlot,
  isoDate,
  isFrozen,
  motiveFor,
  nextTrainDate,
  programFinished,
  programWeek,
  sumFood,
  sessionsRu,
  clientStreak,
  visitDatesOf,
  visitSession,
  WEEK_GOAL,
  workoutKcal,
} from "@/data/studio";
import { recentVisitDays, weekVisitDays } from "@/lib/program-screen";
import { activeClient, useStudio } from "@/lib/studio-store";
import { exerciseOptions, sameExercise } from "@/lib/exercises";
import {
  applySetMark,
  legacyMarkMap,
  nextSet,
  parseFactKg,
  PHASE_HINT,
  PHASE_LABEL,
  planTotalsFromBlocks,
  rirLabel,
  rewriteFacts,
  rewriteMarks,
  sessionPlan,
  setCount,
  setMark,
  setsDone,
  type ProgramBlock,
} from "@/lib/program-blocks";
import { MapRouteButtons } from "@/components/app/map-route-buttons";
import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { Fold } from "@/components/app/fold";
import { specialDataAllowed } from "@/lib/privacy";
import { cn } from "@/lib/utils";
import { detectPRs, e1rm, e1rmTrend, isReliable } from "@/lib/athlete-metrics";
import { activeLogFor, canUndoWorkout } from "@/lib/workout-undo";
import { formatMmSs, liftLabel, previousLift, restSecondsLeft } from "@/lib/client-program";
import { hapticNotify } from "@/lib/haptics";
import { Check, Flame } from "lucide-react";

export function ProgramView() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const food = useStudio((s) => s.food);
  const lifts = useStudio((s) => s.lifts);
  const addLift = useStudio((s) => s.addLift);
  const arrive = useStudio((s) => s.arrive);
  const visits = useStudio((s) => s.visits);
  const markSet = useStudio((s) => s.markSet);
  const completeWorkout = useStudio((s) => s.completeWorkout);
  const undoWorkout = useStudio((s) => s.undoWorkout);
  const checks = useStudio((s) => s.checks);
  const workoutLogs = useStudio((s) => s.workoutLogs);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const [exercise, setExercise] = useState<string | null>(null);
  // empty on purpose: a default would be saved as a real lift if the client taps without typing
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("");
  const [rir, setRir] = useState<number | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  // the block ticked last stays in the list until the next tick, so its fact can be typed right away
  const [justDone, setJustDone] = useState<string | null>(null);
  // rest countdown after a ticked block (client only); the timestamp runs in memory, not saved
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setChartReady(true), []);
  const showToast = useStudio((s) => s.showToast);
  const setTab = useStudio((s) => s.setTab);
  const role = useStudio((s) => s.role);
  // the trainer sees the program but does not check in, start or finish the client's workout, or tick blocks
  const isTrainer = role === "trainer";
  const client = activeClient({ clients, activeClientId });
  const options = useMemo(
    () =>
      exerciseOptions({
        custom: client?.exerciseNames ?? [],
        historyNames: lifts.filter((l) => l.clientId === client?.id).map((l) => l.exercise),
      }),
    [client, lifts],
  );
  const current = exercise && options.includes(exercise) ? exercise : (options[0] ?? "жим");
  const myLifts = useMemo(
    () =>
      client
        ? lifts
            .filter((l) => sameExercise(l.exercise, current) && l.clientId === client.id)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((l) => ({ date: l.date, exercise: l.exercise, weight: l.weight, reps: l.reps, rir: l.rir }))
        : [],
    [lifts, current, client],
  );
  const series = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const l of myLifts) {
      if (!isReliable(l.reps, l.rir)) continue;
      byDay.set(l.date, Math.max(byDay.get(l.date) ?? 0, e1rm(l.weight, l.reps, l.rir)));
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rm]) => ({ date, label: formatDayMonth(date), rm }));
  }, [myLifts]);
  const trend = useMemo(() => e1rmTrend(myLifts, current), [myLifts, current]);
  const lastPr = useMemo(() => detectPRs(myLifts).at(-1) ?? null, [myLifts]);
  const unreliableOnly = myLifts.length > 0 && series.length === 0;
  const today = isoDate(new Date());
  const startKey = client ? `ruksha:wo:${client.id}:${today}` : "";
  const factKey = client ? `ruksha:fact:${client.id}:${today}` : "";
  useEffect(() => {
    if (!factKey) return;
    try {
      setFacts(JSON.parse(localStorage.getItem(factKey) || "{}") as Record<string, string>);
    } catch {
      setFacts({});
    }
  }, [factKey]);
  useEffect(() => {
    if (!startKey) return;
    const raw = localStorage.getItem(startKey);
    setStartedAt(raw ? Number(raw) : null);
  }, [startKey]);
  useEffect(() => {
    if (!startedAt && !restUntil) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, restUntil]);
  useEffect(() => {
    if (restUntil && now >= restUntil) {
      hapticNotify("success");
      setRestUntil(null);
    }
  }, [now, restUntil]);
  if (!client) {
    return <EmptyHint>Программа появится после того, как тренер добавит вас и назначит дни.</EmptyHint>;
  }
  const session = visitSession(client, today, bookings, visits);
  const week = programWeek(client, today);
  const finished = programFinished(client, today);
  const phase = finished ? undefined : client.programPhases?.[String(week)];
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  // визиты — состоявшиеся посещения (checkedIn или «Я на месте»); записи без прихода счётчики не двигают
  const visitDates = visitDatesOf(client.id, bookings, visits);
  const weekVisits = weekVisitDays(visitDates, today);
  const recentVisits = recentVisitDays(visitDates, today);
  const streak = clientStreak(client, bookings, visits, today);
  const next = nextTrainDate(client, bookings, today);
  const nextBook = next ? bookings.find((b) => b.clientId === client.id && b.date === next) : undefined;
  const nextSession = next ? visitSession(client, next, bookings, visits) : null;
  const hoursToToday = todayBook ? hoursUntilSlot(todayBook.date, todayBook.time) : null;

  const eaten = sumFood(food.filter((f) => f.date === today && f.clientId === client.id));
  const t = dayKbju(client, today, bookings).kbju;
  const todayWorkout = activeLogFor(workoutLogs.filter((w) => w.clientId === client.id && w.date === today));
  const shown = session ?? nextSession;
  const planMissingWeights = Boolean(
    shown?.items?.length &&
      !shown.items.some((line) => /\d+(?:[.,]\d+)?\s*кг/i.test(line)),
  );
  const plan = shown ? sessionPlan(shown) : { blocks: [] as ProgramBlock[], owner: [] as string[] };
  const legacy = shown ? legacyMarkMap(shown) : {};
  const checked = rewriteMarks(checks[`${client.id}:${today}`] ?? [], legacy);
  // facts typed during the workout, or the ones saved with the finished workout (so the trainer sees them)
  const factsById: Record<string, string> = {
    ...(todayWorkout?.facts ?? {}),
    ...(shown ? rewriteFacts(facts, shown) : {}),
  };
  const doneCount = plan.blocks.filter((b) => checked.includes(b.id)).length;
  // done blocks leave the list (less to scroll); totals and marks still count them
  const visibleBlocks = showDone
    ? plan.blocks
    : plan.blocks.filter((b) => !checked.includes(b.id) || b.id === justDone);
  const itemCount = plan.blocks.length;
  const restLeft = restSecondsLeft(restUntil, now);
  // подходы: отметки на каждый подход; блок выполнен, когда отмечены все его подходы
  const setMarks = checks[`${client.id}:${today}:sets`] ?? [];
  const nextSetInfo = nextSet(plan.blocks, checked, setMarks);
  const setsTotalAll = plan.blocks.reduce((sum, b) => sum + setCount(b), 0);
  const setsDoneAll = plan.blocks.reduce((sum, b) => sum + setsDone(b, setMarks, checked.includes(b.id)), 0);
  // отмена или отметка подхода: отдых только после отмеченного подхода, если впереди ещё есть подходы
  const onSetMark = (b: ProgramBlock, index: number, on: boolean) => {
    const total = setCount(b);
    markSet(b.id, index, total, on);
    if (!on) return;
    setJustDone(b.id);
    const after = applySetMark(setMarks, checked, b.id, index, total, true);
    if (b.rest && nextSet(plan.blocks, after.checked, after.marks)) setRestUntil(Date.now() + b.rest * 1000);
  };
  const lastResult = (exercise: string) => {
    const prev = previousLift(lifts, client.id, exercise, today);
    return prev ? liftLabel(prev) : null;
  };
  const elapsedSec = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const elapsedMin = startedAt ? Math.max(1, Math.round(elapsedSec / 60)) : 0;
  const totals = planTotalsFromBlocks(plan.blocks, checked, factsById);
  const restMin = Math.round(totals.restSec / 60);
  const withRest = elapsedMin + restMin;
  const clock = (ts: number) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const liveKcal = checked.length
    ? workoutKcal(client.weight, withRest || todayBook?.duration || 60, checked.length, itemCount || 1) + Math.round(totals.volume * 0.04)
    : 0;
  const trainDay = Boolean(todayBook) || client.trainDays.includes(dowIndex(today));
  const arrived = Boolean(todayBook?.checkedIn) || visits.some((row) => row.clientId === client.id && row.date === today);
  const foodCount = food.filter((f) => f.date === today && f.clientId === client.id).length;
  const ritual = dayRitual({
    trainDay,
    arrived,
    workout: Boolean(todayWorkout),
    foodCount,
  });
  const viewer = isTrainer ? "trainer" : "client";
  // сегодняшний статус визита: записан / в зале; для тренера — без обращения на «вы»
  const todayStatus = arrived
    ? isTrainer
      ? "клиент в зале"
      : "вы в зале"
    : todayBook
      ? isTrainer
        ? "записан на сегодня"
        : "вы записаны на сегодня"
      : "";
  const motive = motiveFor({
    client,
    today,
    trainDay,
    checkedIn: Boolean(todayBook?.checkedIn),
    hoursToSession: hoursToToday,
    foodCount,
    workout: todayWorkout,
    checks: checked.length,
    totalItems: itemCount,
    frozen: isFrozen(client),
    streak,
    viewer,
  });

  return (
    <div className="stagger-in flex flex-col gap-3">
      <Surface glow="ok">
        <SectionLabel>{motive.kicker}</SectionLabel>
        <p className="font-display mt-2 text-xl leading-tight tracking-wide">{motive.line}</p>
        <p className="mt-2 text-tiny text-muted-foreground">Серия {streak} · дисциплина дня {ritual.done}/3</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <RitualTick on={ritual.visit} label={ritual.restDay ? "отдых" : "визит"} />
          <RitualTick on={ritual.workout} label="тренировка" />
          <RitualTick on={ritual.food} label="еда" />
        </div>
      </Surface>

      <Surface glow={client.sessionsLeft <= 2 ? "alert" : session ? "ok" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <SectionLabel>
            {client.programTitle} · {finished ? `завершена, ${client.programWeeks} нед.` : `нед. ${week}/${client.programWeeks}`}
            {phase ? ` · ${PHASE_LABEL[phase]}` : ""}
          </SectionLabel>
          <p className="text-tiny text-muted-foreground tabular-nums">
            {client.sessionsLeft} {sessionsRu(client.sessionsLeft)}
          </p>
        </div>
        {phase ? <p className="mt-1 text-tiny text-muted-foreground">{PHASE_HINT[phase]}</p> : null}
        {session ? (
          <>
            <h2 className="font-display mt-2 text-xl tracking-wide">{session.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {session.focus} · день {client.sessions.indexOf(session) + 1} из {client.sessions.length}
              {todayStatus ? ` · ${todayStatus}` : ""}
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display mt-2 text-xl tracking-wide">Сегодня не тренировочный</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {next ? `Ближайший визит ${formatDayMonth(next)}` : "Ближайший визит не назначен"}
              {nextSession ? ` · ${nextSession.name}` : ""}
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Дни: {client.trainDays.map((d) => DOW[d]).join(" · ") || "не назначены"} ·{" "}
          {todayBook?.time ?? nextBook?.time ?? (client.trainTimes.join(", ") || "время свободно")}
        </p>
        {recentVisits >= 3 ? (
          <p className="mt-2 text-tiny text-foreground">После этой — день восстановления. Сон и белок важнее ещё одного подхода.</p>
        ) : null}
        <div className="mt-3">
          <p className="text-tiny text-muted-foreground">
            Неделя · {weekVisits} из {WEEK_GOAL}
          </p>
          <div className="mt-1.5 flex gap-1.5">
            {Array.from({ length: WEEK_GOAL }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < weekVisits ? "bg-ok" : "bg-secondary"}`} />
            ))}
          </div>
        </div>
        {todayBook && hoursToToday !== null && hoursToToday > 0 && hoursToToday < 24 ? (
          <p className="mt-2 text-tiny text-foreground">Старт {countdownLabel(todayBook.date, todayBook.time)}</p>
        ) : null}
        {todayBook ? <MapRouteButtons address={notifyPrefs.address || ""} /> : null}
        {!isTrainer && (todayBook || trainDay) && !arrived ? (
          <button
            type="button"
            onClick={() => arrive()}
            className="pressable mt-3 h-12 w-full rounded-xl bg-secondary text-sm font-medium text-foreground"
          >
            Я на месте
          </button>
        ) : arrived && !isTrainer ? (
          <p className="mt-3 text-sm text-foreground">Вы на месте. Вода +250 мл.</p>
        ) : null}
      </Surface>

      {shown ? (
        <Surface glow={todayWorkout ? "ok" : undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-base">{shown.name}</p>
            <p className="text-xs text-muted-foreground">{shown.focus}</p>
          </div>
          {planMissingWeights ? (
            <div className="mt-3 rounded-xl border border-border/60 bg-secondary/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">
                {isTrainer
                  ? "В плане нет рабочих весов. Проставьте их в редакторе программы."
                  : "Тренер ещё не проставил рабочие веса в вашем плане."}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              Упражнений {doneCount} из {plan.blocks.length} · подходов {setsDoneAll} из {setsTotalAll}
            </span>
            {doneCount > 0 ? (
              <button
                type="button"
                className="pressable h-9 rounded-lg px-3 text-alert-text"
                onClick={() => setShowDone((v) => !v)}
              >
                {showDone ? "Скрыть выполненные" : `Показать выполненные (${doneCount})`}
              </button>
            ) : null}
          </div>
          {restLeft > 0 ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-ok-dim px-4 py-3">
              <p className="flex items-baseline gap-2 text-sm text-ok">
                Отдых
                <span className="font-display text-3xl leading-none tabular-nums text-ok">{formatMmSs(restLeft)}</span>
              </p>
              <button
                type="button"
                className="pressable h-9 rounded-lg px-3 text-sm text-muted-foreground"
                onClick={() => setRestUntil(null)}
              >
                Пропустить
              </button>
            </div>
          ) : null}
          {!showDone && plan.blocks.length > 0 && doneCount === plan.blocks.length ? (
            <p className="mt-2 text-sm text-foreground">Всё выполнено</p>
          ) : null}
          <ul className="mt-2 space-y-2">
            {cardsOf(visibleBlocks).map((card) => (
              <li
                key={`card-${card[0].id}`}
                className={cn(
                  "rounded-lg px-1 py-1",
                  card.length > 1 ? "border border-primary/40 bg-secondary/30" : "border border-hairline/60",
                )}
              >
                {card.length > 1 ? (
                  <p className="px-2 pt-1 text-2xs  tracking-wide text-alert-text">Суперсет</p>
                ) : null}
                {card.map((b) => (
                  <BlockRow
                    key={b.id}
                    block={b}
                    on={checked.includes(b.id)}
                    setMarks={Array.from({ length: setCount(b) }, (_, i) => checked.includes(b.id) || setMarks.includes(setMark(b.id, i)))}
                    currentSet={nextSetInfo && nextSetInfo.block.id === b.id ? nextSetInfo.index : null}
                    fact={factsById[b.id] ?? ""}
                    last={lastResult(b.exercise)}
                    readOnly={isTrainer}
                    onSet={(index, on) => onSetMark(b, index, on)}
                    onFact={(value) => {
                      const next = { ...factsById, [b.id]: value };
                      setFacts(next);
                      if (factKey) localStorage.setItem(factKey, JSON.stringify(next));
                    }}
                  />
                ))}
              </li>
            ))}
          </ul>
          {nextSetInfo ? (
            <button
              type="button"
              onClick={() => onSetMark(nextSetInfo.block, nextSetInfo.index, true)}
              className="pressable mt-3 flex h-12 w-full items-center justify-between rounded-xl bg-primary px-4 text-left text-primary-foreground shadow-glow-alert"
            >
              <span className="text-sm font-medium">
                Завершить подход {nextSetInfo.index + 1} из {nextSetInfo.total}
              </span>
              <span className="max-w-[45%] truncate text-tiny">{nextSetInfo.block.exercise}</span>
            </button>
          ) : null}
          <p className="mt-3 text-xs text-muted-foreground">
            Общий вес {totals.volume} кг · подходы {totals.sets} · работа {startedAt ? elapsedMin : 0} мин · отдых {restMin} мин
          </p>
          <div className="mt-4 border-t border-hairline pt-3">
            <Fold title={`Сожжено · ${todayWorkout ? todayWorkout.kcal : isTrainer ? 0 : liveKcal} ккал`}>
              <p className="font-display mt-1 flex items-baseline gap-2 text-3xl tabular-nums">
                {todayWorkout ? todayWorkout.kcal : isTrainer ? 0 : liveKcal}
                <span className="text-base font-sans font-normal text-muted-foreground">ккал</span>
                <Flame className="size-4 text-alert-text" />
              </p>
              <p className="mt-1 text-tiny text-muted-foreground">
                {todayWorkout
                  ? `${todayWorkout.minutes} мин${todayWorkout.startedAt ? ` · ${clock(Date.parse(todayWorkout.startedAt))}–${clock(Date.parse(todayWorkout.at))}` : ""}`
                  : startedAt
                    ? `${clock(startedAt)} · ${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`
                    : isTrainer
                      ? "Клиент ещё не начал тренировку"
                      : "Нажмите «Начать», время пойдёт в калории"}
              </p>
            </Fold>
          </div>
          {todayWorkout ? (
            <div className="mt-3">
              <p className="text-sm text-foreground">
                Тренировка закрыта · {todayWorkout.minutes} мин · {todayWorkout.kcal} ккал
              </p>
              {!isTrainer && canUndoWorkout(todayWorkout, Date.now()) ? (
                <button
                  type="button"
                  className="pressable mt-2 h-10 w-full rounded-lg bg-secondary text-sm"
                  onClick={() => {
                    // undo keeps the record cancelled and restores the day; the timer resumes from the original start
                    const restored = todayWorkout.startedAt ? Date.parse(todayWorkout.startedAt) : null;
                    if (!undoWorkout()) return;
                    // the facts saved with the workout go back into the editable list
                    if (todayWorkout.facts) {
                      setFacts(todayWorkout.facts);
                      try {
                        if (factKey) localStorage.setItem(factKey, JSON.stringify(todayWorkout.facts));
                      } catch {
                        /* ignore */
                      }
                    }
                    if (restored && startKey) {
                      try {
                        localStorage.setItem(startKey, String(restored));
                      } catch {
                        /* ignore */
                      }
                      setStartedAt(restored);
                    }
                  }}
                >
                  Отменить завершение
                </button>
              ) : null}
            </div>
          ) : isTrainer ? null : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(startedAt)}
                onClick={() => {
                  const stamp = Date.now();
                  setStartedAt(stamp);
                  localStorage.setItem(startKey, String(stamp));
                }}
                className="pressable h-12 rounded-xl bg-secondary text-sm font-medium disabled:opacity-50"
              >
                {startedAt ? "Идёт" : "Начать"}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!startedAt) {
                    showToast("Сначала нажмите «Начать».");
                    return;
                  }
                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume, factsById);
                  try {
                    if (startKey) localStorage.removeItem(startKey);
                    if (factKey) localStorage.removeItem(factKey);
                  } catch {
                    /* ignore */
                  }
                  setStartedAt(null);
                  setFacts({});
                  showToast("Тренировка записана · можно отметить еду");
                  setTab("food");
                }}
                className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
              >
                Завершить
              </button>
            </div>
          )}
        </Surface>
      ) : (
        <p className="text-sm text-muted-foreground">
          {client.sessions.length === 0
            ? "Тренер ещё не назначил программу. Когда назначит — день сам подтянется к визиту."
            : isTrainer
              ? "Дни тренировок не назначены. Добавьте их в расписание клиента."
              : "Тренер ещё не назначил дни тренировок."}
        </p>
      )}

      {client.sessions.length > 1 ? (
        <Fold title={`Цикл программы · ${client.sessions.length} дн.`}>
        <div className="flex flex-col gap-2">
          {client.sessions.map((day, i) => {
            const active = shown?.id === day.id;
            return (
              <Surface key={day.id} className={cn(active ? "glow-ok bg-ok-dim" : "opacity-70")}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-sm">{day.name}</p>
                  <p className="text-2xs text-muted-foreground">
                    визит {i + 1} · {day.focus}
                  </p>
                </div>
              </Surface>
            );
          })}
        </div>
        </Fold>
      ) : null}

      {specialDataAllowed(client.consent) ? (
        <Fold title={`КБЖУ · ${t.calories > 0 ? `${eaten.calories} из ${t.calories} ккал` : `${eaten.calories} ккал`}`}>
        <Surface>
          <KbjuMeters
            title={`КБЖУ · ${t.calories > 0 ? "ваша цель" : "сегодня"}`}
            eaten={eaten}
            target={t}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            {t.calories > 0
              ? `Сегодня: ${eaten.calories} из ${t.calories} ккал. Цель от тренера.`
              : eaten.calories > 0
                ? `Сегодня: ${eaten.calories} ккал по вашим записям. Цель тренер ещё не задал.`
                : "Добавьте еду во вкладке «Еда» — цифры появятся здесь."}
          </p>
        </Surface>
        </Fold>
      ) : (
        <Surface>
          <p className="text-tiny text-muted-foreground">
            {isTrainer
              ? "Питание клиента скрыто: клиент не дал согласия на данные о здоровье."
              : "Питание — с вашего согласия. Дать его можно в «Профиль» → «Мои данные»."}
          </p>
        </Surface>
      )}

      <Fold title="Повторный максимум">
      <Surface>
        <p className="mt-1 text-tiny text-muted-foreground">Считается по весу, повторам и запасу (сколько повторов осталось в баке). Подходы, где повторы + запас больше 10, не учитываются: там формула врёт.</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {options.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setExercise(item)}
              className={cn(
                "pressable h-9 rounded-full px-3 text-sm",
                current === item ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="font-display mt-3 text-3xl tabular-nums">
          {series.at(-1)?.rm ?? 0}
          <span className="ml-2 text-base font-sans font-normal text-muted-foreground">кг · максимум</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {trend.status === "ok"
            ? `Тренд: ${trend.kgPerWeek > 0 ? "+" : ""}${trend.kgPerWeek} кг/нед за ${trend.sessions} тренировок`
            : "Для тренда нужно минимум 3 тренировки за 14 дней."}
          {lastPr ? ` · Последний рекорд ${formatDayMonth(lastPr.date)}: ${lastPr.e1rm} кг (+${lastPr.gain})` : ""}
        </p>
        {unreliableOnly ? (
          <p className="mt-1 text-xs text-muted-foreground">Все записи — длинные подходы, для ПМ они не годятся. Запишите подход, где повторы + запас не больше 10.</p>
        ) : null}
        <div className="mt-3 h-44">
          {chartReady && series.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={36} domain={["dataMin - 5", "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 12,
                    color: "var(--color-foreground)",
                  }}
                  formatter={(value) => [`${value} кг`, "максимум"]}
                />
                <Line type="monotone" dataKey="rm" stroke="var(--color-ok)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-ok)" }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
              {series.length === 1 ? "Ещё одна запись — и появится график" : "Запишите подход, чтобы увидеть ПМ"}
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Вес, кг">
            <input className={inputClass} inputMode="decimal" placeholder="60" value={kg} onChange={(e) => setKg(e.target.value)} />
          </Field>
          <Field label="Повторы">
            <input className={inputClass} inputMode="numeric" placeholder="8" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="Подходы">
            <input className={inputClass} inputMode="numeric" placeholder="3" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
            <span id="rir-label">Повторов в запасе</span>
            <div className="flex gap-1" role="group" aria-labelledby="rir-label">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={rir === v}
                  onClick={() => setRir(rir === v ? null : v)}
                  className={cn(
                    "pressable h-11 flex-1 rounded-lg text-sm tabular-nums",
                    rir === v ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {v === 3 ? "3+" : v}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="pressable col-span-2 h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
            onClick={() => {
              const w = Number(kg.replace(",", "."));
              const r = Number(reps);
              const st = Number(sets);
              if (!w || !r || !st) {
                showToast("Введите вес, повторы и подходы.");
                return;
              }
              addLift(current, w, r, st, rir ?? undefined);
              setRir(null);
            }}
          >
            Записать подход
          </button>
        </div>
      </Surface>
      </Fold>
    </div>
  );
}

function RitualTick({ on, label }: { on: boolean; label: string }) {
  return (
    <div className={cn("rounded-lg px-2 py-2 text-center", on ? "bg-ok-dim" : "bg-secondary")}>
      <p className={cn("grid place-items-center", on ? "text-ok" : "text-muted-foreground")}>
        {on ? <Check className="size-3.5" /> : <span className="block size-1.5 rounded-full bg-muted-foreground/50" />}
      </p>
      <p className="mt-1 text-2xs text-muted-foreground">{label}</p>
    </div>
  );
}


  

/** Consecutive blocks with the same superset group form one card. */
function cardsOf(blocks: ProgramBlock[]): ProgramBlock[][] {
  const cards: ProgramBlock[][] = [];
  for (const b of blocks) {
    const last = cards.at(-1);
    if (last && b.group && last[0].group === b.group) last.push(b);
    else cards.push([b]);
  }
  return cards;
}

function BlockRow({
  block,
  on,
  setMarks,
  currentSet,
  fact,
  readOnly,
  last,
  onSet,
  onFact,
}: {
  block: ProgramBlock;
  /** упражнение выполнено целиком */
  on: boolean;
  /** отметка каждого подхода */
  setMarks: boolean[];
  /** индекс следующего подхода этого упражнения, null когда он не текущий */
  currentSet: number | null;
  fact: string;
  /** тренер видит факт веса, но не вводит его: факт — со стороны клиента */
  readOnly: boolean;
  /** the client's latest result for this exercise, before today */
  last: string | null;
  onSet: (index: number, on: boolean) => void;
  onFact: (value: string) => void;
}) {
  const meta = [
    block.sets > 0 && block.reps ? `${block.sets}×${block.reps}${block.side ? ` на каждую ${block.side}` : ""}` : "",
    block.load ? `${block.load} кг` : "",
    block.rest != null ? `отдых ${block.rest} с` : "",
    block.rir != null ? rirLabel(block.rir) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const doneCount = setMarks.filter(Boolean).length;
  return (
    <>
      <div className="rounded-lg px-2 py-2.5 text-sm">
        <span className="block min-w-0">
          <span className={cn("block font-medium", on && "line-through text-muted-foreground")}>{block.exercise}</span>
          {meta ? <span className="mt-0.5 block text-tiny text-muted-foreground">{meta}</span> : null}
          {last ? <span className="mt-0.5 block text-tiny tabular-nums text-muted-foreground">в прошлый раз {last}</span> : null}
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {setMarks.map((filled, i) => {
            const isNext = currentSet === i && !filled;
            const cls = cn(
              "grid size-11 shrink-0 place-items-center rounded-full border-2 text-xs tabular-nums transition-colors",
              filled ? "border-ok bg-ok text-ok-foreground" : isNext ? "border-primary text-foreground" : "border-hairline text-muted-foreground",
            );
            const label = `Подход ${i + 1} из ${setMarks.length}: ${block.exercise}`;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSet(i, !filled)}
                aria-pressed={filled}
                aria-label={filled ? `Снять отметку: ${label}` : `Отметить: ${label}`}
                className={cn("pressable", cls)}
              >
                {filled ? <Check className="size-5" strokeWidth={3} /> : i + 1}
              </button>
            );
          })}
          <span className="ml-1 text-tiny tabular-nums text-muted-foreground">
            {doneCount}/{setMarks.length}
          </span>
        </div>
      </div>
      {readOnly && on && fact ? (
        <p className="mt-1 mb-2 ml-2 text-tiny text-muted-foreground">
          {parseFactKg(fact) != null ? `Факт: ${parseFactKg(fact)} кг` : `Факт: ${fact}`}
        </p>
      ) : null}
      {!readOnly && on && block.load ? (
        <div className="mt-1 mb-2 ml-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <input
              className={cn(inputClass, "w-28 tabular-nums")}
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              aria-label={`Факт веса, кг: ${block.exercise}`}
              aria-invalid={fact.trim() !== "" && parseFactKg(fact) == null}
              placeholder={`${block.load}`}
              value={fact}
              onChange={(e) => onFact(e.target.value.replace(/[^\d.,\s]/g, ""))}
            />
            <span className="text-tiny text-muted-foreground">кг</span>
          </div>
          <span className="text-tiny text-muted-foreground">
            {fact.trim() !== "" && parseFactKg(fact) == null
              ? "Введите число, например 22,5"
              : `план ${block.load} кг, если пусто`}
          </span>
        </div>
      ) : null}
    </>
  );
}
