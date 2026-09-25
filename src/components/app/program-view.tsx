import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  countdownLabel,
  dayRitual,
  dayKbju,
  DOW,
  dowIndex,
  EXERCISES,
  formatDayMonth,
  hoursUntilSlot,
  isoDate,
  isFrozen,
  motiveFor,
  nextTrainDate,
  programWeek,
  sumFood,
  sessionsRu,
  visitSession,
  WEEK_GOAL,
  weekVisitCount,
  epley1rm,
  planTotals,
  lineGroup,
  readPlanLine,
  workoutKcal,
} from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { Field, inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { Check, Flame } from "lucide-react";

export function ProgramView() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const food = useStudio((s) => s.food);
  const lifts = useStudio((s) => s.lifts);
  const addLift = useStudio((s) => s.addLift);
  const checkIn = useStudio((s) => s.checkIn);
  const toggleCheck = useStudio((s) => s.toggleCheck);
  const completeWorkout = useStudio((s) => s.completeWorkout);
  const checks = useStudio((s) => s.checks);
  const workoutLogs = useStudio((s) => s.workoutLogs);
  const [exercise, setExercise] = useState("жим");
  const [kg, setKg] = useState("60");
  const [reps, setReps] = useState("6");
  const [sets, setSets] = useState("4");
  const [chartReady, setChartReady] = useState(false);
  const [facts, setFacts] = useState<Record<number, string>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setChartReady(true), []);
  const showToast = useStudio((s) => s.showToast);
  const client = activeClient({ clients, activeClientId });
  const series = useMemo(() => {
    if (!client) return [];
    const byDay = new Map<string, number>();
    for (const lift of lifts.filter((l) => l.exercise === exercise && l.clientId === client.id)) {
      const rm = epley1rm(lift.weight, lift.reps);
      byDay.set(lift.date, Math.max(byDay.get(lift.date) ?? 0, rm));
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, rm]) => ({ date, label: formatDayMonth(date), rm }));
  }, [lifts, exercise, client]);
  const today = isoDate(new Date());
  const startKey = client ? `ruksha:wo:${client.id}:${today}` : "";
  const factKey = client ? `ruksha:fact:${client.id}:${today}` : "";
  useEffect(() => {
    if (!factKey) return;
    try {
      setFacts(JSON.parse(sessionStorage.getItem(factKey) || "{}") as Record<number, string>);
    } catch {
      setFacts({});
    }
  }, [factKey]);
  useEffect(() => {
    if (!startKey) return;
    const raw = sessionStorage.getItem(startKey);
    setStartedAt(raw ? Number(raw) : null);
  }, [startKey]);
  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  if (!client) {
    return <EmptyHint>Программа появится после того, как тренер добавит вас и назначит дни.</EmptyHint>;
  }
  const session = visitSession(client, today, bookings);
  const week = programWeek(client, today);
  const visiting = bookings.some((b) => b.clientId === client.id && b.date === today);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const weekLoad = bookings.filter((b) => b.clientId === client.id && b.date >= isoDate(new Date(Date.now() - 6 * 86400000))).length;
  const weekVisits = weekVisitCount(bookings, client.id);
  const next = nextTrainDate(client);
  const nextSession = visitSession(client, next, bookings);
  const hoursToToday = todayBook ? hoursUntilSlot(todayBook.date, todayBook.time) : null;

  const eaten = sumFood(food.filter((f) => f.date === today && f.clientId === client.id));
  const t = dayKbju(client, today, bookings).kbju;
  const todayWorkout = workoutLogs.find((w) => w.clientId === client.id && w.date === today) ?? null;
  const shown = session ?? nextSession;
  const checked = checks[`${client.id}:${today}`] ?? [];
  const itemCount = shown?.items.length ?? 0;
  const elapsedSec = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const elapsedMin = startedAt ? Math.max(1, Math.round(elapsedSec / 60)) : 0;
  const totals = planTotals(shown?.items ?? [], checked, facts);
  const restMin = Math.round(totals.restSec / 60);
  const withRest = elapsedMin + restMin;
  const clock = (ts: number) => new Date(ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const liveKcal = checked.length
    ? workoutKcal(client.weight, withRest || todayBook?.duration || 60, checked.length, itemCount || 1) + Math.round(totals.volume * 0.04)
    : 0;
  const trainDay = Boolean(todayBook) || client.trainDays.includes(dowIndex(today));
  const foodCount = food.filter((f) => f.date === today && f.clientId === client.id).length;
  const ritual = dayRitual({
    trainDay,
    checkedIn: Boolean(todayBook?.checkedIn),
    workout: Boolean(todayWorkout),
    foodCount,
    reportedToday: client.lastReportAt === today,
  });
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
  });

  return (
    <div className="stagger-in flex flex-col gap-3">
      <Surface glow="ok">
        <SectionLabel>{motive.kicker}</SectionLabel>
        <p className="font-display mt-2 text-xl leading-tight tracking-wide">{motive.line}</p>
        <p className="mt-2 text-tiny text-muted-foreground">Серия {client.streak} · дисциплина дня {ritual.done}/3</p>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <RitualTick on={ritual.hall} label={ritual.restDay ? "отдых" : "зал"} />
          <RitualTick on={ritual.food} label="еда" />
          <RitualTick on={ritual.report} label="явка" />
        </div>
      </Surface>

      <Surface glow={client.sessionsLeft <= 2 ? "alert" : session ? "ok" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <SectionLabel>
            {client.programTitle} · нед. {week}/{client.programWeeks}
          </SectionLabel>
          <p className="text-tiny text-muted-foreground tabular-nums">
            {client.sessionsLeft} {sessionsRu(client.sessionsLeft)}
          </p>
        </div>
        {session ? (
          <>
            <h2 className="font-display mt-2 text-xl tracking-wide">{session.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {session.focus}
              {visiting ? " · вы сегодня в зале" : ` · день ${(client.sessions.indexOf(session) + 1)} из ${client.sessions.length}`}
            </p>
          </>
        ) : (
          <>
            <h2 className="font-display mt-2 text-xl tracking-wide">Сегодня не тренировочный</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Ближайший визит {formatDayMonth(next)}
              {nextSession ? ` · ${nextSession.name}` : ""}
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Дни: {client.trainDays.map((d) => DOW[d]).join(" · ") || "не назначены"} ·{" "}
          {client.trainTimes.join(", ") || "время свободно"}
        </p>
        {weekLoad >= 3 ? (
          <p className="mt-2 text-tiny text-ok">После этой — день восстановления. Сон и белок важнее ещё одного подхода.</p>
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
          <p className="mt-2 text-tiny text-ok">Старт {countdownLabel(todayBook.date, todayBook.time)}</p>
        ) : null}
        {todayBook && !todayBook.checkedIn ? (
          <button
            type="button"
            onClick={() => checkIn(todayBook.id)}
            className="pressable mt-3 h-12 w-full rounded-xl bg-ok text-sm font-medium text-ok-foreground"
          >
            Я на месте
          </button>
        ) : todayBook?.checkedIn ? (
          <p className="mt-3 text-sm text-ok">Чек-ин принят. Хорошей тренировки.</p>
        ) : null}
      </Surface>

      {shown ? (
        <Surface glow={todayWorkout ? "ok" : undefined}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-base">{shown.name}</p>
            <p className="text-xs text-muted-foreground">{shown.focus}</p>
          </div>
          <ul className="mt-3 space-y-1.5">
            {shown.items.map((item, index) => {
              const mark = `${index}:${item}`;
              const on = checked.includes(mark);
              const bit = readPlanLine(item);
              return (
                <li key={mark}>
                  <button
                    type="button"
                    onClick={() => {
                      const marks = lineGroup(shown.items, index).map((i) => `${i}:${shown.items[i]}`);
                      const allOn = marks.every((m) => checked.includes(m));
                      for (const markId of marks) {
                        if (checked.includes(markId) === allOn) toggleCheck(markId);
                      }
                    }}
                    className={cn(
                      "pressable flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm",
                      on ? "bg-ok-dim text-foreground" : "bg-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border",
                        on ? "border-ok bg-ok text-ok-foreground" : "border-hairline",
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <span className={on ? "line-through opacity-70" : ""}>{item}</span>
                  </button>
                  {on && bit.kind === "weight" ? (
                    <input
                      className={cn(inputClass, "mt-1 ml-10")}
                      inputMode="decimal"
                      placeholder="факт, кг — если другой"
                      value={facts[index] ?? ""}
                      onChange={(e) => {
                        const next = { ...facts, [index]: e.target.value };
                        setFacts(next);
                        if (factKey) sessionStorage.setItem(factKey, JSON.stringify(next));
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Общий вес {totals.volume} кг · подходы {totals.sets} · работа {startedAt ? elapsedMin : 0} мин · отдых {restMin} мин
          </p>
          <div className="mt-4 border-t border-hairline pt-3">
            <SectionLabel>Сожжено</SectionLabel>
            <p className="font-display mt-1 flex items-baseline gap-2 text-3xl tabular-nums">
              {todayWorkout ? todayWorkout.kcal : liveKcal}
              <span className="text-base font-sans font-normal text-muted-foreground">ккал</span>
              <Flame className="size-4 text-primary" />
            </p>
            <p className="mt-1 text-tiny text-muted-foreground">
              {todayWorkout
                ? `${todayWorkout.minutes} мин${todayWorkout.startedAt ? ` · ${clock(Date.parse(todayWorkout.startedAt))}–${clock(Date.parse(todayWorkout.at))}` : ""}`
                : startedAt
                  ? `${clock(startedAt)} · ${String(Math.floor(elapsedSec / 60)).padStart(2, "0")}:${String(elapsedSec % 60).padStart(2, "0")}`
                  : "Нажмите «Начать», время пойдёт в калории"}
            </p>
          </div>
          {todayWorkout ? (
            <p className="mt-3 text-sm text-ok">
              Тренировка закрыта · {todayWorkout.minutes} мин · {todayWorkout.kcal} ккал
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={Boolean(startedAt)}
                onClick={() => {
                  const stamp = Date.now();
                  setStartedAt(stamp);
                  sessionStorage.setItem(startKey, String(stamp));
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
                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume);
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
          Тренер ещё не назначил программу. Когда назначит — день сам подтянется к визиту.
        </p>
      )}

      {client.sessions.length > 1 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Цикл · строго по порядку визитов</SectionLabel>
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
      ) : null}

      <Surface>
        <SectionLabel>КБЖУ · ваша цель</SectionLabel>
        <div className="mt-3">
          <ProgressRail value={eaten.calories} max={t.calories} />
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          <Macro label="ккал" value={t.calories} current={eaten.calories} />
          <Macro label="Б" value={t.protein} current={eaten.protein} />
          <Macro label="Ж" value={t.fat} current={eaten.fat} />
          <Macro label="У" value={t.carbs} current={eaten.carbs} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Сегодня: {eaten.calories} ккал. Тренер выставил индивидуально.
        </p>
      </Surface>

      <Surface>
        <SectionLabel>Повторный максимум</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">Считается по весу и повторам. 1 повтор = этот вес.</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {EXERCISES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setExercise(item)}
              className={cn(
                "pressable h-9 rounded-full px-3 text-sm",
                exercise === item ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="font-display mt-3 text-3xl tabular-nums">
          {series.at(-1)?.rm ?? 0}
          <span className="ml-2 text-base font-sans font-normal text-muted-foreground">кг ПМ</span>
        </p>
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
                  formatter={(value) => [`${value} кг`, "ПМ"]}
                />
                <Line type="monotone" dataKey="rm" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
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
            <input className={inputClass} inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
          </Field>
          <Field label="Повторы">
            <input className={inputClass} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="Подходы">
            <input className={inputClass} inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
          <button
            type="button"
            className="pressable mt-6 h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
            onClick={() => {
              const w = Number(kg.replace(",", "."));
              const r = Number(reps);
              const st = Number(sets);
              if (!w || !r || !st) {
                showToast("Введите вес, повторы и подходы.");
                return;
              }
              addLift(exercise, w, r, st);
            }}
          >
            Записать подход
          </button>
        </div>
      </Surface>
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

function Macro({
  label,
  value,
  current,
}: {
  label: string;
  value: number;
  current: number;
}) {
  const ratio = Math.min(1, current / value);
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 40 40" className="size-12 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeDasharray={`${c * ratio} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-sm tabular-nums">{value}</span>
      <span className="text-2xs tracking-wide text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
