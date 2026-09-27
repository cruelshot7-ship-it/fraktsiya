import { useEffect, useState } from "react";
import { FATSECRET_URL, FORM_GOALS, isoDate, MOVE_KINDS, TRACKABLES_URL } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { openTelegramUrl } from "@/lib/telegram";
import { inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";

const HEALTH_APP = "https://apps.apple.com/app/id1115567069";

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
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");

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
        <p className="mt-1 text-xs text-muted-foreground">Шаги, сон и движение с часов. Вода — по стаканам. Цифры сохраняются у тренера.</p>
        {saved?.source === "apple" ? <p className="mt-1 text-tiny text-primary">Сегодня уже пришло из Apple Health.</p> : null}
        <div className="mt-3 flex flex-col gap-3">
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
        <button
          type="button"
          className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() =>
            saveDayCheck({
              steps: Number(steps) || 0,
              sleepHours: Number(sleep.replace(",", ".")) || 0,
              waterMl: Number(water) || 0,
              moveMin: Number(move) || 0,
              moveKind: kind,
            })
          }
        >
          Записать день
        </button>
        <div className="mt-3 flex gap-1">
          {week.map((day) => (
            <span key={day.iso} className={`h-1.5 flex-1 rounded-full ${day.on ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>
      </Surface>

      <Surface>
        <SectionLabel>FatSecret</SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">Приложение само не подключается. Откройте дневник, перенесите итог дня сюда. Он попадёт в «Еду».</p>
        <button type="button" className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm" onClick={() => openTelegramUrl(FATSECRET_URL)}>
          Открыть FatSecret
        </button>
        <div className="mt-2 grid grid-cols-4 gap-2">
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
              showToast("Впишите калории из FatSecret.");
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

      <Surface>
        <SectionLabel>Apple Health</SectionLabel>
        <p className="mt-1 text-xs text-muted-foreground">
          Часы пишут в Здоровье. Бот сам туда зайти не может. Ссылка ниже принимает шаги, сон, воду и минуты движения.
        </p>
        <button
          type="button"
          className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm"
          onClick={() => {
            if (!hook) return;
            void navigator.clipboard?.writeText(hook);
            showToast("Ссылка скопирована");
          }}
        >
          Скопировать ссылку для Команд
        </button>
        <p className="mt-2 text-tiny text-muted-foreground">
          Команды: «Найти образцы Здоровья» → шаги за сегодня → «Получить содержимое URL» → GET, в конец ссылки допишите &steps= и число. Так же можно &sleep=7.5 и &moveMin=30.
        </p>
        <button
          type="button"
          className="pressable mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            if (!healthLink) return;
            window.location.href = healthLink;
          }}
        >
          Подключить Health Auto Export
        </button>
        <button type="button" className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm" onClick={() => openTelegramUrl(HEALTH_APP)}>
          Открыть Health Auto Export
        </button>
        <button
          type="button"
          className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm"
          onClick={() => {
            if (!hook) return;
            void fetch(`${hook}&ping=1`)
              .then((res) => res.json())
              .then((data: { linked?: boolean }) => showToast(data.linked ? "Связь с залом есть" : "Ссылка ещё не дошла. Подождите и откройте снова."))
              .catch(() => showToast("Связь не ответила."));
          }}
        >
          Проверить связь
        </button>
        <button type="button" className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm" onClick={() => openTelegramUrl(TRACKABLES_URL)}>
          Смотреть цифры в Trackables
        </button>
      </Surface>
    </div>
  );
}
