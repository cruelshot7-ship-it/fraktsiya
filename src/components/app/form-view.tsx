import { useEffect, useState } from "react";
import { FORM_GOALS, isoDate, MOVE_KINDS } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { readiness, type ReadinessDay } from "@/lib/athlete-metrics";

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
  const [fatigue, setFatigue] = useState<number | null>(saved?.fatigue ?? null);
  const [soreness, setSoreness] = useState<number | null>(saved?.soreness ?? null);
  const [pain, setPain] = useState<number | null>(saved?.pain ?? null);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  const [autoOpen, setAutoOpen] = useState(false);
  const [hook, setHook] = useState("");
  const [healthLink, setHealthLink] = useState("");

  useEffect(() => {
    if (!client) return;
    const token = ensureHealthToken();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setHook(`${origin}/api/health?token=${token}`);
    setHealthLink(`healthautoexport://x-callback-url/export?tokens=${token}`);
  }, [client, ensureHealthToken]);

  if (!client) return <EmptyHint>Форма откроется после входа в зал.</EmptyHint>;

  const recoveryReady = fatigue != null || soreness != null || pain != null;
  const recoveryLabel = recoveryReady
    ? readiness(
        {
          date: today,
          sleepHours: Number(sleep.replace(",", ".")) || 0,
          fatigue: fatigue ?? 2,
          soreness: soreness ?? 2,
          pain: pain ?? 0,
        } satisfies ReadinessDay,
        [],
      ).reason
    : null;

  return (
    <div className="flex flex-col gap-3">
      <Surface>
        <SectionLabel>День</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Шаги
            <input className={inputClass} inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder={String(FORM_GOALS.steps)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Сон, ч
            <input className={inputClass} inputMode="decimal" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder={String(FORM_GOALS.sleep)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Вода, мл
            <input className={inputClass} inputMode="numeric" value={water} onChange={(e) => setWater(e.target.value)} placeholder={String(FORM_GOALS.water)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Движение, мин
            <input className={inputClass} inputMode="numeric" value={move} onChange={(e) => setMove(e.target.value)} placeholder={String(FORM_GOALS.move)} />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {MOVE_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              className={
                kind === k
                  ? "pressable rounded-lg bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
                  : "pressable rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground"
              }
              onClick={() => setKind(k)}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">Восстановление (сохраняется с днём)</p>
          <div className="flex flex-col gap-1.5">
            <span className="text-2xs text-muted-foreground">Усталость 1–5</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={fatigue === v}
                  onClick={() => setFatigue(fatigue === v ? null : v)}
                  className={
                    fatigue === v ? "pressable h-10 flex-1 rounded-lg bg-primary text-sm text-primary-foreground" : "pressable h-10 flex-1 rounded-lg bg-secondary text-sm text-muted-foreground"
                  }
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
                  key={v}
                  type="button"
                  aria-pressed={soreness === v}
                  onClick={() => setSoreness(soreness === v ? null : v)}
                  className={
                    soreness === v ? "pressable h-10 flex-1 rounded-lg bg-primary text-sm text-primary-foreground" : "pressable h-10 flex-1 rounded-lg bg-secondary text-sm text-muted-foreground"
                  }
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
                  key={v}
                  type="button"
                  aria-pressed={pain === v}
                  onClick={() => setPain(pain === v ? null : v)}
                  className={
                    pain === v ? "pressable h-10 flex-1 rounded-lg bg-primary text-sm text-primary-foreground" : "pressable h-10 flex-1 rounded-lg bg-secondary text-sm text-muted-foreground"
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
        {recoveryLabel ? (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            Сегодня: {recoveryLabel}
          </p>
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
