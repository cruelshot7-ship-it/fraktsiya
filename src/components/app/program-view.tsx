import { useMemo, useState } from "react";
import {
  EXERCISES,
  isoDate,
  isFrozen,
  visitSession,
  WEEK_GOAL,
  weekVisitCount,
} from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { Field, inputClass, ProgressRail, SectionLabel, Surface } from "@/components/app/bits";

export function ProgramView() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const food = useStudio((s) => s.food);
  const lifts = useStudio((s) => s.lifts);
  const addLift = useStudio((s) => s.addLift);
  const checkIn = useStudio((s) => s.checkIn);
  const client = activeClient({ clients, activeClientId });
  const today = isoDate(new Date());
  const session = visitSession(client, today, bookings);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const visits = weekVisitCount(bookings, client.id);
  const eaten = food.filter((f) => f.date === today && f.clientId === client.id);
  const kcal = eaten.reduce((n, f) => n + f.calories, 0);
  const frozen = isFrozen(client);

  const [ex, setEx] = useState(EXERCISES[0]);
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [sets, setSets] = useState("3");

  const todayLifts = useMemo(
    () => lifts.filter((l) => l.clientId === client.id && l.date === today),
    [client.id, lifts, today],
  );

  return (
    <div className="stagger-in flex flex-col gap-3">
      <Surface glow={frozen ? "alert" : "ok"}>
        <SectionLabel>Сегодня</SectionLabel>
        <h2 className="font-display mt-1 text-2xl">{session?.name ?? "Восстановление"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {frozen ? "Заморозка — слоты закрыты." : session?.focus ?? "День без зала. Держите дневник еды."}
        </p>
        <div className="mt-3">
          <ProgressRail value={visits} max={WEEK_GOAL} tone="ok" />
        </div>
        <p className="mt-2 text-tiny text-muted-foreground">
          Неделя {visits}/{WEEK_GOAL} · еда {kcal} ккал
        </p>
      </Surface>

      {session ? (
        <Surface>
          <SectionLabel>План</SectionLabel>
          <ul className="mt-2 space-y-1.5 text-sm">
            {session.items.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-ok" />
                {item}
              </li>
            ))}
          </ul>
        </Surface>
      ) : null}

      {todayBook && !todayBook.checkedIn ? (
        <button
          type="button"
          className="pressable h-12 rounded-xl bg-ok text-sm font-medium text-ok-foreground"
          onClick={() => checkIn(todayBook.id)}
        >
          Я в зале · {todayBook.time}
        </button>
      ) : todayBook?.checkedIn ? (
        <Surface glow="ok">
          <p className="text-sm">Чек-ин {todayBook.time} закрыт.</p>
        </Surface>
      ) : null}

      <Surface>
        <SectionLabel>Силовые</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Движение">
            <select className={inputClass} value={ex} onChange={(e) => setEx(e.target.value as typeof ex)}>
              {EXERCISES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Вес">
            <input className={inputClass} inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
          </Field>
          <Field label="Повторы">
            <input className={inputClass} inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </Field>
          <Field label="Подходы">
            <input className={inputClass} inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          </Field>
        </div>
        <button
          type="button"
          className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            if (!Number(kg) || !Number(reps)) return;
            addLift(ex, Number(kg), Number(reps), Number(sets) || 3);
            setKg("");
            setReps("");
          }}
        >
          Записать подход
        </button>
        {todayLifts.map((lift) => (
          <p key={lift.id} className="mt-2 text-tiny text-muted-foreground">
            {lift.exercise} · {lift.weight} кг × {lift.reps} × {lift.sets}
          </p>
        ))}
      </Surface>
    </div>
  );
}
