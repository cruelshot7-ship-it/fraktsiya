import { useEffect, useState } from "react";
import { WheelField } from "@/components/app/wheel-picker";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDayMonth, type Client } from "@/data/studio";
import { specialDataAllowed } from "@/lib/privacy";
import { activeClient, useStudio } from "@/lib/studio-store";
import { studioToday } from "@/lib/minsk-time";
import { inputClass, SectionLabel, Surface } from "@/components/app/bits";
import { FormView } from "@/components/app/form-view";
import { weightChangeWeek, weightSeries, type WeightRange } from "@/lib/weight-trend";

const RANGES: { value: WeightRange; label: string }[] = [
  { value: 7, label: "7 дней" },
  { value: 30, label: "30 дней" },
  { value: 0, label: "Всё" },
];

/**
 * График веса: один главный показатель и его динамика. Период переключается, точки берутся из истории.
 * Для графика нужны хотя бы две точки в выбранном периоде.
 */
function WeightChart({ history }: { history: Client["weightHistory"] }) {
  const [range, setRange] = useState<WeightRange>(30);
  const [ready, setReady] = useState(false);
  // как на тренерском экране: контейнер измеряется только после первого кадра (иначе график схлопывается в WebView)
  useEffect(() => setReady(true), []);
  const series = weightSeries(history, range, studioToday());
  return (
    <div className="mt-4">
      <div role="group" aria-label="Период графика веса" className="flex gap-1.5">
        {RANGES.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={range === item.value}
            onClick={() => setRange(item.value)}
            className={`pressable h-9 rounded-lg px-3 text-2xs ${
              range === item.value ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="mt-3 h-44">
        {ready && series.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDayMonth(String(value))}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                minTickGap={24}
              />
              <YAxis
                domain={["dataMin - 0.5", "dataMax + 0.5"]}
                tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(value) => String(Math.round(Number(value) * 10) / 10).replace(".", ",")}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--color-foreground)",
                }}
                formatter={(value) => [`${String(value).replace(".", ",")} кг`, "вес"]}
                labelFormatter={(label) => formatDayMonth(String(label))}
              />
              <Line type="monotone" dataKey="kg" stroke="var(--color-ok)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-ok)" }} isAnimationActive />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            Для графика нужны две записи веса за период. Запишите вес — точка появится здесь.
          </p>
        )}
      </div>
    </div>
  );
}

/** Ввод веса клиентом: сохраняет за сегодня, повторный ввод заменяет запись за этот день. */
function WeightEntry({ current }: { current: number }) {
  const setWeight = useStudio((s) => s.setWeight);
  const showToast = useStudio((s) => s.showToast);
  const [value, setValue] = useState(current > 0 ? String(current).replace(".", ",") : "");
  const save = () => {
    const kg = Number(value.replace(",", "."));
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      showToast("Введите вес от 30 до 300 кг.");
      return;
    }
    setWeight(kg);
    showToast("Вес сохранён.");
  };
  return (
    <Surface>
      <label className="text-2xs text-muted-foreground">Вес сегодня, кг</label>
      <div className="mt-1.5 flex gap-2">
        <WheelField
          label="Вес сегодня, кг"
          kind="dec"
          unit="кг"
          min={30}
          max={300}
          start={80}
          value={value}
          onChange={setValue}
          placeholder="82,5"
          className="min-w-0 flex-1"
        />
        <button type="button" onClick={save} className="pressable h-11 shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Сохранить
        </button>
      </div>
    </Surface>
  );
}

/**
 * Прогресс клиента: вес за неделю и самочувствие (с замерами). Всё это данные о здоровье,
 * поэтому без согласия экран не монтирует карточки — только подсказка.
 */
export function ProgressView() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const me = activeClient({ clients, activeClientId });
  if (!me) {
    return <p className="text-sm text-muted-foreground">Прогресс появится, когда тренер добавит вас.</p>;
  }
  if (!specialDataAllowed(me.consent)) {
    return (
      <Surface>
        <p className="text-tiny text-muted-foreground">
          Вес, замеры и самочувствие — с вашего согласия. Дать его можно в «Профиль» → «Мои данные».
        </p>
      </Surface>
    );
  }
  const change = weightChangeWeek(me.weightHistory);

  return (
    <div className="space-y-4">
      <SectionLabel>Вес</SectionLabel>
      <Surface>
        {me.weight > 0 ? (
          <>
            <p className="font-display text-3xl tabular-nums">
              {me.weight.toFixed(1).replace(".", ",")}
              <span className="ml-1 text-base text-muted-foreground">кг</span>
            </p>
            {change !== null ? (
              <p className="mt-1 text-tiny text-muted-foreground">
                {change > 0 ? "+" : ""}
                {change.toFixed(1).replace(".", ",")} кг за 7 дней
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Вес ещё не записан.</p>
        )}
        <WeightChart history={me.weightHistory} />
      </Surface>
      <WeightEntry current={me.weight} />
      <SectionLabel>Самочувствие и замеры</SectionLabel>
      <FormView />
    </div>
  );
}
