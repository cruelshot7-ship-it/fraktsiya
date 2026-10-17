import { WheelField } from "@/components/app/wheel-picker";
import { useState } from "react";
import { FORM_GOALS, isTrainDay, MOVE_KINDS, studioToday } from "@/data/studio";
import { trainDayHints, type LoadHintTone } from "@/lib/day-load-hint";
import { activeClient, useStudio } from "@/lib/studio-store";
import { specialDataAllowed } from "@/lib/privacy";
import { Fold } from "@/components/app/fold";
import { inputClass, ProgressRail, Surface, EmptyHint } from "@/components/app/bits";
import { readiness, type ReadinessDay } from "@/lib/athlete-metrics";
import { MeasuresCard } from "@/components/app/measures-card";

const TONE_CLASS: Record<LoadHintTone, string> = {
  reduce: "text-foreground",
  extra: "text-ok",
  fuel: "text-foreground",
};

export function FormView() {
  const dayChecks = useStudio((s) => s.dayChecks);
  const saveDayCheck = useStudio((s) => s.saveDayCheck);
  const importFatSecret = useStudio((s) => s.importFatSecret);
  const showToast = useStudio((s) => s.showToast);
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const activeClientId = useStudio((s) => s.activeClientId);
  const client = activeClient({ clients, activeClientId });
  const today = studioToday();
  const saved = dayChecks.find((row) => row.clientId === client?.id && row.date === today);
  const [steps, setSteps] = useState(saved ? String(saved.steps || "") : "");
  const [sleep, setSleep] = useState(saved?.sleepHours ? String(saved.sleepHours) : "");
  const [water, setWater] = useState(saved ? String(saved.waterMl || "") : "");
  const [move, setMove] = useState(saved ? String(saved.moveMin || "") : "");
  const [kind, setKind] = useState(saved?.moveKind || "Ходьба");
  const [fatigue, setFatigue] = useState<number | null>(saved?.fatigue ?? null);
  const [soreness, setSoreness] = useState<number | null>(saved?.soreness ?? null);
  const [pain, setPain] = useState<number | null>(saved?.pain ?? null);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  // подсказки строятся из введённого сейчас; самочувствие берём только при согласии на данные о здоровье
  const canHealth = specialDataAllowed(client?.consent);
  const train = client ? isTrainDay(client, today, bookings) : false;
  const loadHints =
    train && client
      ? trainDayHints({
          sleepHours: Number(sleep.replace(",", ".")) || 0,
          fatigue: canHealth ? fatigue : null,
          soreness: canHealth ? soreness : null,
          kcal: Number(kcal) || 0,
          targetKcal: client.kbju.calories,
        })
      : [];
  const [paste, setPaste] = useState("");

  if (!client) return <EmptyHint>Форма откроется, когда тренер добавит вас в зал.</EmptyHint>;

  const recoveryReady = fatigue != null || soreness != null || pain != null;
  const recoveryDecision = recoveryReady
    ? readiness(
        {
          date: today,
          sleepHours: Number(sleep.replace(",", ".")) || 0,
          fatigue: fatigue ?? 2,
          soreness: soreness ?? 2,
          pain: pain ?? 0,
        } satisfies ReadinessDay,
        [],
      )
    : null;
  const recoveryLabel =
    recoveryDecision?.status === "skip"
      ? "Пропуск: сильная боль"
      : recoveryDecision?.status === "modify"
        ? "Заменить упражнения (боль)"
        : recoveryDecision?.status === "reduce"
          ? "Снизить нагрузку"
          : recoveryDecision?.status === "watch"
            ? "Смотреть самочувствие"
            : recoveryDecision?.status === "ok"
              ? "Можно тренироваться"
              : null;

  return (
    <div className="flex flex-col gap-3">
      <Fold title="Записать день">
      <Surface>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Шаги</label>
            <WheelField label="Шаги" value={steps} onChange={setSteps} max={40000} step={100} start={FORM_GOALS.steps} placeholder={String(FORM_GOALS.steps)} allowEmpty />
            <ProgressRail value={Number(steps) || 0} max={FORM_GOALS.steps} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Сон, ч</label>
            <WheelField label="Сон, часы" kind="dec" unit="ч" value={sleep} onChange={setSleep} max={16} start={FORM_GOALS.sleep} placeholder={String(FORM_GOALS.sleep)} allowEmpty />
            <ProgressRail value={Number(sleep.replace(",", ".")) || 0} max={FORM_GOALS.sleep} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Вода, мл</label>
            <div className="flex gap-1.5">
              <WheelField label="Вода, мл" unit="мл" value={water} onChange={setWater} max={5000} step={50} start={FORM_GOALS.water} placeholder={String(FORM_GOALS.water)} allowEmpty className="flex-1" />
              {[250, 500].map((add) => (
                <button
                  key={add}
                  type="button"
                  className="pressable h-11 shrink-0 rounded-lg bg-secondary px-3 text-sm"
                  onClick={() => setWater(String((Number(water) || 0) + add))}
                >
                  +{add}
                </button>
              ))}
            </div>
            <ProgressRail value={Number(water) || 0} max={FORM_GOALS.water} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Движение, мин</label>
            <WheelField label="Движение, мин" unit="мин" value={move} onChange={setMove} max={300} step={5} start={FORM_GOALS.move} placeholder={String(FORM_GOALS.move)} allowEmpty />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MOVE_KINDS.map((item) => (
              <button
                key={item}
                type="button"
                className={`pressable h-11 rounded-lg px-2.5 text-xs ${kind === item ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground"}`}
                onClick={() => setKind(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {specialDataAllowed(client?.consent) ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Восстановление</p>
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-muted-foreground">Усталость 1–5</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={`f${v}`}
                  type="button"
                  aria-pressed={fatigue === v}
                  onClick={() => setFatigue(fatigue === v ? null : v)}
                  className={`pressable h-9 flex-1 rounded-lg text-xs ${
                    fatigue === v ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-muted-foreground">Крепатура 1–5</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={`s${v}`}
                  type="button"
                  aria-pressed={soreness === v}
                  onClick={() => setSoreness(soreness === v ? null : v)}
                  className={`pressable h-9 flex-1 rounded-lg text-xs ${
                    soreness === v ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-muted-foreground">Боль 0–3</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={`p${v}`}
                  type="button"
                  aria-pressed={pain === v}
                  onClick={() => setPain(pain === v ? null : v)}
                  className={`pressable h-9 flex-1 rounded-lg text-xs ${
                    pain === v ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Усталость, крепатуру и боль отмечаем только с согласия. Дать или отозвать его можно в «Профиль» → «Мои данные».
          </p>
        )}
        {recoveryLabel ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            Сегодня: {recoveryLabel}
          </p>
        ) : null}
        {loadHints.length ? (
          <div className="mt-3 space-y-1.5" aria-live="polite">
            <p className="text-tiny text-muted-foreground">Тренировочный день. Менять программу может только тренер.</p>
            {loadHints.map((hint) => (
              <p key={hint.text} className={`rounded-lg bg-card px-3 py-2 text-sm ${TONE_CLASS[hint.tone]}`}>
                {hint.text}
              </p>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            saveDayCheck({
              steps: Number(steps) || 0,
              sleepHours: Number(sleep.replace(",", ".")) || 0,
              waterMl: Number(water) || 0,
              moveMin: Number(move) || 0,
              moveKind: kind,
              fatigue: fatigue ?? undefined,
              soreness: soreness ?? undefined,
              pain: pain ?? undefined,
            });
          }}
        >
          Сохранить день
        </button>
      </Surface>
      </Fold>

      <Fold title="Внести еду из FatSecret">
      <Surface>
        <p className="text-xs text-muted-foreground">Одно число калорий за день. Белки, жиры и углеводы можно не писать.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <WheelField label="Калории, ккал" value={kcal} onChange={setKcal} max={5000} step={10} start={2000} placeholder="ккал" allowEmpty />
          <WheelField label="Белки, г" value={protein} onChange={setProtein} unit="г" max={500} start={100} placeholder="Б" allowEmpty />
          <WheelField label="Жиры, г" value={fat} onChange={setFat} unit="г" max={300} start={70} placeholder="Ж" allowEmpty />
          <WheelField label="Углеводы, г" value={carbs} onChange={setCarbs} unit="г" max={600} start={200} placeholder="У" allowEmpty />
        </div>
        <button
          type="button"
          className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm"
          onClick={() => {
            if (!(Number(kcal) || 0)) {
              showToast("Впишите калории.");
              return;
            }
            importFatSecret({
              calories: Number(kcal) || 0,
              protein: Number(protein) || 0,
              fat: Number(fat) || 0,
              carbs: Number(carbs) || 0,
            });
          }}
        >
          Внести в еду
        </button>
      </Surface>
      </Fold>

      <MeasuresCard client={client} />

    </div>
  );
}
