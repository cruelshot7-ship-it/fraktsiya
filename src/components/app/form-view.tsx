import { useEffect, useState } from "react";
import { FORM_GOALS, isoDate, MOVE_KINDS } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";

export function FormView() {
  const dayChecks = useStudio((s) => s.dayChecks);
  const saveDayCheck = useStudio((s) => s.saveDayCheck);
  const importFatSecret = useStudio((s) => s.importFatSecret);
  const ensureHealthToken = useStudio((s) => s.ensureHealthToken);
  const showToast = useStudio((s) => s.showToast);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const client = activeClient({ clients, activeClientId });
  const today = isoDate(new Date());
  const saved = dayChecks.find((row) => row.clientId === client?.id && row.date === today);
  const [steps, setSteps] = useState(saved ? String(saved.steps || "") : "");
  const [sleep, setSleep] = useState(saved?.sleepHours ? String(saved.sleepHours) : "");
  const [water, setWater] = useState(saved ? String(saved.waterMl || "") : "");
  const [move, setMove] = useState(saved ? String(saved.moveMin || "") : "");
  const [kind, setKind] = useState(saved?.moveKind || "Ходьба");
  const [fatigue, setFatigue] = useState<number | null>(
    typeof saved?.fatigue === "number" ? saved.fatigue : null,
  );
  const [soreness, setSoreness] = useState<number | null>(
    typeof saved?.soreness === "number" ? saved.soreness : null,
  );
  const [pain, setPain] = useState<number | null>(typeof saved?.pain === "number" ? saved.pain : null);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [paste, setPaste] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);

  useEffect(() => {
    if (client && !client.healthToken) ensureHealthToken();
  }, [client, ensureHealthToken]);

  if (!client) return <EmptyHint>Форма откроется, когда тренер добавит вас в зал.</EmptyHint>;

  const token = client.healthToken || "";
  const hook = token ? `${window.location.origin}/api/health?token=${token}` : "";
  const healthLink = hook
    ? `com.HealthExport://automation?url=${encodeURIComponent(hook)}&name=${encodeURIComponent("Ruksha")}&format=json&period=today&interval=days&enabled=true&datatype=healthmetrics&aggregatedata=true`
    : "";

  const week = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const iso = isoDate(date);
    return { iso, on: dayChecks.some((row) => row.clientId === client.id && row.date === iso && (row.steps > 0 || row.waterMl > 0 || row.sleepHours > 0)) };
  });

  return (
    <div className="flex flex-col gap-3">
      <Surface>
        <SectionLabel>Сегодня</SectionLabel>
        <div className="mt-2 flex gap-1">
          {week.map((day) => (
            <div
              key={day.iso}
              className={`h-2 flex-1 rounded-full ${
                day.on ? "bg-primary" : "bg-secondary"
              }`}
              title={day.iso}
            />
          ))}
        </div>
        <div className="mt-3 space-y-3">
          <label className="block">
            <span className="text-tiny text-muted-foreground">Шаги · цель {FORM_GOALS.steps}</span>
            <input className={inputClass} inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="0" />
            <div className="mt-2">
              <ProgressRail value={Number(steps) || 0} max={FORM_GOALS.steps} />
            </div>
          </label>
          <label className="block">
            <span className="text-tiny text-muted-foreground">Сон, часы · цель {FORM_GOALS.sleep}</span>
            <input className={inputClass} inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="7.5" />
            <div className="mt-2">
              <ProgressRail value={Number(sleep.replace(",", ".")) || 0} max={FORM_GOALS.sleep} />
            </div>
          </label>
          <div>
            <span className="text-tiny text-muted-foreground">Вода, мл · цель {FORM_GOALS.water}</span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {[250, 500, 750, 1000].map((add) => (
                <button
                  key={add}
                  type="button"
                  className="pressable h-11 rounded-lg bg-secondary text-sm"
                  onClick={() => setWater(String((Number(water) || 0) + add))}
                >
                  +{add}
                </button>
              ))}
            </div>
            <input className={`${inputClass} mt-2`} inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value)} placeholder="0" />
            <div className="mt-2">
              <ProgressRail value={Number(water) || 0} max={FORM_GOALS.water} />
            </div>
          </div>
          <div>
            <span className="text-tiny text-muted-foreground">Движение вне зала, мин · цель {FORM_GOALS.move}</span>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {MOVE_KINDS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`pressable h-11 rounded-lg text-xs ${kind === item ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                  onClick={() => setKind(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <input className={`${inputClass} mt-2`} inputMode="numeric" value={move} onChange={(e) => setMove(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <span className="text-tiny text-muted-foreground">Восстановление (необяз.)</span>
          <div>
            <span className="text-2xs text-muted-foreground">Усталость 1–5</span>
            <div className="mt-1 flex gap-1" role="group" aria-label="Усталость">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={`f${v}`}
                  type="button"
                  aria-pressed={fatigue === v}
                  onClick={() => setFatigue(fatigue === v ? null : v)}
                  className={`pressable h-9 flex-1 rounded-lg text-xs ${
                    fatigue === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-2xs text-muted-foreground">Крепатура 1–5</span>
            <div className="mt-1 flex gap-1" role="group" aria-label="Крепатура">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={`s${v}`}
                  type="button"
                  aria-pressed={soreness === v}
                  onClick={() => setSoreness(soreness === v ? null : v)}
                  className={`pressable h-9 flex-1 rounded-lg text-xs ${
                    soreness === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-2xs text-muted-foreground">Боль 0–3</span>
            <div className="mt-1 flex gap-1" role="group" aria-label="Боль">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={`p${v}`}
                  type="button"
                  aria-pressed={pain === v}
                  onClick={() => setPain(pain === v ? null : v)}
                  className={`pressable h-9 flex-1 rounded-lg text-xs ${
                    pain === v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            const patch: Parameters<typeof saveDayCheck>[0] & {
              fatigue?: number;
              soreness?: number;
              pain?: number;
            } = {
              steps: Number(steps) || 0,
              sleepHours: Number(sleep.replace(",", ".")) || 0,
              waterMl: Number(water) || 0,
              moveMin: Number(move) || 0,
              moveKind: kind,
            };
            if (fatigue != null) patch.fatigue = fatigue;
            if (soreness != null) patch.soreness = soreness;
            if (pain != null) patch.pain = pain;
            saveDayCheck(patch);
          }}
        >
          Сохранить день
        </button>
      </Surface>

      <Surface>
        <SectionLabel>Еда из FatSecret</SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">Одно число калорий за день. Белки, жиры и углеводы можно не писать.</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <input className={inputClass} inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="ккал" />
          <input className={inputClass} inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Б" />
          <input className={inputClass} inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Ж" />
          <input className={inputClass} inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="У" />
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

      <button type="button" className="self-start text-xs text-muted-foreground" onClick={() => setAutoOpen((open) => !open)}>
        {autoOpen ? "Скрыть авто" : "Само с часов"}
      </button>
      {autoOpen ? (
        <Surface>
          <p className="text-xs text-muted-foreground">Один раз вставь ссылку в Health Auto Export. Дальше цифры приходят сами.</p>
          <button
            type="button"
            className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm"
            onClick={() => {
              if (!hook) return;
              void navigator.clipboard?.writeText(hook);
              showToast("Ссылка скопирована");
            }}
          >
            Скопировать ссылку
          </button>
          <button
            type="button"
            className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm"
            onClick={() => {
              if (!healthLink) return;
              window.location.href = healthLink;
            }}
          >
            Открыть Health Auto Export
          </button>
        </Surface>
      ) : null}
    </div>
  );
}
