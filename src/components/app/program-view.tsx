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
  const trend = useMemo(() => e1rmTrend(myLifts), [myLifts]);
  const lastPr = useMemo(() => {
    const prs = detectPRs(myLifts);
    return prs.length ? prs[prs.length - 1] : null;
  }, [myLifts]);

  if (!client) return <EmptyHint>Программа откроется, когда тренер добавит вас в зал.</EmptyHint>;

  const today = isoDate(new Date());
  const session = visitSession(client, today, bookings);
  const week = programWeek(client, today);
  const visiting = bookings.some((b) => b.clientId === client.id && b.date === today);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const nextSession = client.sessions[0] ?? null;
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
  const elapsedMin = Math.floor(elapsedSec / 60);
  const restMin = startedAt ? Math.max(0, elapsedMin - Math.min(elapsedMin, itemCount * 3)) : 0;
  const withRest = startedAt ? elapsedMin : 0;
  const totals = planTotals(shown?.items ?? [], checked, facts);
  const kcal = client
    ? workoutKcal(client.weight, withRest || todayBook?.duration || 60, checked.length, itemCount || 1) +
      Math.round(totals.volume * 0.04)
    : 0;

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const frozen = isFrozen(client);
  const nextTrain = nextTrainDate(client, today);
  const weekVisits = weekVisitCount(client, bookings, today);
  const ritual = dayRitual(client, today, food, visits);
  const kbju = dayKbju(client, today);
  const foodToday = sumFood(food.filter((f) => f.clientId === client.id && f.date === today));

  return (
    <div className="flex flex-col gap-3">
      <Surface glow={client.sessionsLeft <= 2 ? "alert" : session ? "ok" : undefined}>
        <div className="flex items-start justify-between gap-3">
          <SectionLabel>
            {client.programTitle} · нед. {week}/{client.programWeeks}
          </SectionLabel>
          <p className="text-right text-xs text-muted-foreground">
            {client.sessionsLeft} {sessionsRu(client.sessionsLeft)}
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {frozen
            ? `Заморозка до ${client.frozenUntil}`
            : session
              ? visiting
                ? " · вы сегодня в зале"
                : ` · день ${client.sessions.indexOf(session) + 1} из ${client.sessions.length}`
              : nextTrain
                ? `Следующая · ${formatDayMonth(nextTrain)}`
                : "Нет ближайшей тренировки"}
        </p>
        {todayBook ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Слот {todayBook.time} · {countdownLabel(hoursUntilSlot(todayBook.date, todayBook.time))}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">{motiveFor(client, weekVisits)}</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <RitualTick on={ritual.sleep} label="Сон" />
          <RitualTick on={ritual.water} label="Вода" />
          <RitualTick on={ritual.steps} label="Шаги" />
          <RitualTick on={ritual.food} label="Еда" />
        </div>
        {session && !visiting ? (
          <button
            type="button"
            className="pressable mt-3 flex h-11 items-center justify-center rounded-lg bg-secondary text-sm"
            onClick={() => arrive()}
          >
            Я в зале
          </button>
        ) : null}
      </Surface>

      {shown ? (
        <Surface>
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
                    <li key={`rest-${group[0]}`} className="px-2 py-1 text-xs text-muted-foreground">
                      {bits.map((b) => b.item).join(" · ")}
                    </li>
                  );
                }
                const weightBit = bits.find((b) => b.bit.kind === "weight");
                const marks = group.map((i) => `${i}:${items[i]}`);
                const on = marks.every((m) => checked.includes(m));
                return (
                  <li key={group.join("-")}>
                    <button
                      type="button"
                      className={cn(
                        "pressable flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm",
                        on ? "bg-ok-dim" : "bg-secondary/50",
                      )}
                      onClick={() => {
                        for (const m of marks) toggleCheck(m);
                      }}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                          on ? "border-ok bg-ok text-ok-foreground" : "border-border",
                        )}
                      >
                        {on ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        {bits.map((b) => (
                          <span key={b.i} className="block">
                            {b.item}
                          </span>
                        ))}
                      </span>
                    </button>
                    {on && weightBit ? (
                      <input
                        className={`${inputClass} mt-1`}
                        inputMode="decimal"
                        placeholder="факт, кг — если другой"
                        value={facts[weightBit.i] ?? ""}
                        onChange={(e) => {
                          setFacts({ ...facts, [weightBit.i]: e.target.value });
                        }}
                      />
                    ) : null}
                  </li>
                );
              });
            })()}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Общий вес {totals.volume} кг · подходы {totals.sets} · работа {startedAt ? elapsedMin : 0} мин · отдых{" "}
            {restMin} мин
          </p>
          <div className="mt-3 flex gap-2">
            {!startedAt ? (
              <button
                type="button"
                className="pressable h-11 flex-1 rounded-lg bg-secondary text-sm"
                onClick={() => setStartedAt(Date.now())}
              >
                Начать
              </button>
            ) : (
              <button
                type="button"
                className="pressable h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                onClick={() => {
                  if (!startedAt) {
                    showToast("Сначала нажмите «Начать».");
                    return;
                  }
                  completeWorkout(itemCount || 1, elapsedMin, new Date(startedAt).toISOString(), totals.volume);
                  showToast("Тренировка записана · можно отметить еду");
                  setStartedAt(null);
                  setFacts({});
                }}
              >
                Завершить · ~{kcal} ккал
              </button>
            )}
          </div>
        </Surface>
      ) : (
        <Surface>
          <p className="text-sm text-muted-foreground">
            Тренер ещё не назначил программу. Когда назначит — день сам подтянется к визиту.
          </p>
        </Surface>
      )}

      {client.sessions.length > 1 ? (
        <Surface>
          <SectionLabel>Все дни</SectionLabel>
          {client.sessions.map((day, i) => (
            <div key={day.id} className="mt-2 rounded-lg bg-secondary/40 px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {i + 1}. {day.name}
                </p>
                <p className="text-xs text-muted-foreground">{day.focus}</p>
              </div>
            </div>
          ))}
        </Surface>
      ) : null}

      <Surface>
        <SectionLabel>КБЖУ сегодня</SectionLabel>
        <KbjuMeters target={kbju} actual={foodToday} />
      </Surface>

      <Surface>
        <SectionLabel>
          Динамика
          <span className="ml-2 text-base font-sans font-normal text-muted-foreground">кг ПМ</span>
        </SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">
          {trend
            ? `Тренд: ${trend.kgPerWeek > 0 ? "+" : ""}${trend.kgPerWeek} кг/нед за ${trend.sessions} тренировок`
            : "Мало данных для тренда"}
          {lastPr ? ` · Последний рекорд ${formatDayMonth(lastPr.date)}: ${lastPr.e1rm} кг (+${lastPr.gain})` : ""}
        </p>
        <div className="mt-2 h-40">
          {chartReady && series.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis width={36} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(value) => [`${value} кг`, "ПМ"]}
                />
                <Line type="monotone" dataKey="rm" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="grid h-full place-items-center px-4 text-center text-sm text-muted-foreground">
              Запишите несколько подходов — появится график
            </p>
          )}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Упражнение">
            <select className={inputClass} value={exercise} onChange={(e) => setExercise(e.target.value)}>
              {EXERCISES.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>
          </Field>
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
