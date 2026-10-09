import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  buildProgram,
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
  planTotals,
  lineGroup,
  readPlanLine,
  workoutKcal,
} from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { mapsUrl } from "@/lib/studio-repeat";
import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { detectPRs, e1rm, e1rmTrend, isReliable } from "@/lib/athlete-metrics";
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
  const toggleCheck = useStudio((s) => s.toggleCheck);
  const completeWorkout = useStudio((s) => s.completeWorkout);
  const updateClient = useStudio((s) => s.updateClient);
  const checks = useStudio((s) => s.checks);
  const workoutLogs = useStudio((s) => s.workoutLogs);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const [exercise, setExercise] = useState("жим");
  const [kg, setKg] = useState("60");
  const [reps, setReps] = useState("6");
  const [sets, setSets] = useState("4");
  const [rir, setRir] = useState<number | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [facts, setFacts] = useState<Record<number, string>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setChartReady(true), []);
  const showToast = useStudio((s) => s.showToast);
  const setTab = useStudio((s) => s.setTab);
  const client = activeClient({ clients, activeClientId });
  const myLifts = useMemo(
    () =>
      client
        ? lifts
            .filter((l) => l.exercise === exercise && l.clientId === client.id)
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((l) => ({ date: l.date, exercise: l.exercise, weight: l.weight, reps: l.reps, rir: l.rir }))
        : [],
    [lifts, exercise, client],
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
  const trend = useMemo(() => e1rmTrend(myLifts, exercise), [myLifts, exercise]);
  const lastPr = useMemo(() => detectPRs(myLifts).at(-1) ?? null, [myLifts]);
  const unreliableOnly = myLifts.length > 0 && series.length === 0;
  const today = isoDate(new Date());
  const startKey = client ? `ruksha:wo:${client.id}:${today}` : "";
  const factKey = client ? `ruksha:fact:${client.id}:${today}` : "";
  useEffect(() => {
    if (!factKey) return;
    try {
      setFacts(JSON.parse(localStorage.getItem(factKey) || "{}") as Record<number, string>);
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
  const planMissingWeights = Boolean(
    shown?.items?.length &&
      !shown.items.some((line) => /\d+(?:[.,]\d+)?\s*кг/i.test(line)),
  );
  const prescribeWorkingWeights = () => {
    const bw = client.weight > 0 ? client.weight : 70;
    const days = client.trainDays?.length ? client.trainDays : [0, 2, 4];
    const rebuilt = buildProgram({ weight: bw, trainDays: days }, "shape", "beginner");
    updateClient(client.id, {
      weight: bw,
      programTitle: rebuilt.programTitle,
      sessions: rebuilt.sessions,
      programWeeks: client.programWeeks || 8,
      programStart: client.programStart || today,
      trainDays: days,
    });
    showToast(
      client.weight > 0
        ? `Рабочие веса по вашим ${bw} кг`
        : `Рабочие веса по ${bw} кг (укажите свой вес в профиле)`,
    );
  };
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
  const arrived = Boolean(todayBook?.checkedIn) || visits.some((row) => row.clientId === client.id && row.date === today);
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
        {todayBook && mapsUrl(notifyPrefs.address || "") ? (
          <a
            href={mapsUrl(notifyPrefs.address)}
            target="_blank"
            rel="noreferrer"
            className="pressable mt-3 flex h-11 items-center justify-center rounded-lg bg-secondary text-sm"
          >
            Маршрут
          </a>
        ) : null}
        {(todayBook || trainDay) && !arrived ? (
          <button
            type="button"
            onClick={() => arrive()}
            className="pressable mt-3 h-12 w-full rounded-xl bg-ok text-sm font-medium text-ok-foreground"
          >
            Я на месте
          </button>
        ) : arrived ? (
          <p className="mt-3 text-sm text-ok">Вы на месте. Вода +250 мл.</p>
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
                В плане нет рабочих весов (часто так, если вес тела не указан при сборке).
              </p>
              <button
                type="button"
                className="pressable mt-2 h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                onClick={prescribeWorkingWeights}
              >
                Проставить рабочие веса
              </button>
            </div>
          ) : null}
          <ul className="mt-3 space-y-2">
            {(() => {
              const items = shown.items;
              const groups: number[][] = [];
              const seen = new Set<number>();
              for (let i = 0; i < items.length; i += 1) {
                if (seen.has(i)) continue;
                const g = lineGroup(items, i);
                g.forEach((j) => seen.add(j));
                groups.push(g);
              }
              return groups.map((group) => {
                const bits = group.map((i) => ({ i, item: items[i], bit: readPlanLine(items[i]) }));
                const restOnly = bits.every((b) => b.bit.kind === "rest");
                if (restOnly) {
                  return (
                    <li key={`rest-${group[0]}`} className="px-2 py-1.5 text-tiny text-muted-foreground">
                      {bits.map((b) => b.item).join(" · ")}
                    </li>
                  );
                }
                const title = bits.find((b) => b.bit.kind === "text") ?? bits[0];
                const meta = bits.filter((b) => b.i !== title.i);
                const marks = group.map((i) => `${i}:${items[i]}`);
                const on = marks.every((m) => checked.includes(m));
                const weightBit = bits.find((b) => b.bit.kind === "weight");
                return (
                  <li key={`g-${group[0]}`} className="rounded-lg border border-hairline/60 px-1 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = marks.every((m) => checked.includes(m));
                        for (const markId of marks) {
                          if (checked.includes(markId) === allOn) toggleCheck(markId);
                        }
                      }}
                      className={cn(
                        "pressable flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm",
                        on ? "bg-ok-dim text-foreground" : "bg-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                          on ? "border-ok bg-ok text-ok-foreground" : "border-hairline",
                        )}
                      >
                        {on ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-medium", on && "line-through opacity-70")}>{title.item}</span>
                        {meta.length ? (
                          <span className="mt-0.5 block text-tiny text-muted-foreground">
                            {meta.map((b) => b.item).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {on && weightBit ? (
                      <input
                        className={cn(inputClass, "mt-1 mb-2 ml-10")}
                        inputMode="decimal"
                        placeholder="факт, кг — если другой"
                        value={facts[weightBit.i] ?? ""}
                        onChange={(e) => {
                          const next = { ...facts, [weightBit.i]: e.target.value };
                          setFacts(next);
                          if (factKey) localStorage.setItem(factKey, JSON.stringify(next));
                        }}
                      />
                    ) : null}
                  </li>
                );
              });
            })()}
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
                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume);
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

      <Surface>
        <SectionLabel>Повторный максимум</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">Считается по весу, повторам и запасу (сколько повторов осталось в баке). Подходы дальше 10 повторов до отказа не учитываются: там формула врёт.</p>
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
        <p className="mt-1 text-xs text-muted-foreground">
          {trend.status === "ok"
            ? `Тренд: ${trend.kgPerWeek > 0 ? "+" : ""}${trend.kgPerWeek} кг/нед за ${trend.sessions} тренировок`
            : "Для тренда нужно минимум 3 тренировки за 14 дней."}
          {lastPr ? ` · Последний рекорд ${formatDayMonth(lastPr.date)}: ${lastPr.e1rm} кг (+${lastPr.gain})` : ""}
        </p>
        {unreliableOnly ? (
          <p className="mt-1 text-xs text-muted-foreground">Все записи — длинные подходы, для ПМ они не годятся. Запишите подход на 1–8 повторов.</p>
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
          <div className="flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground">
            <span id="rir-label">Запас (RIR)</span>
            <div className="flex gap-1" role="group" aria-labelledby="rir-label">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={rir === v}
                  onClick={() => setRir(rir === v ? null : v)}
                  className={cn(
                    "pressable h-11 flex-1 rounded-lg text-sm tabular-nums",
                    rir === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
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
              addLift(exercise, w, r, st, rir ?? undefined);
              setRir(null);
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


  
