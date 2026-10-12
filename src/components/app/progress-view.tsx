import { useState } from "react";
import { specialDataAllowed } from "@/lib/privacy";
import { activeClient, useStudio } from "@/lib/studio-store";
import { inputClass, SectionLabel, Surface } from "@/components/app/bits";
import { FormView } from "@/components/app/form-view";
import { weightChangeWeek } from "@/lib/weight-trend";

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
      <label className="text-xs text-muted-foreground">Вес сегодня, кг</label>
      <div className="mt-1.5 flex gap-2">
        <input
          className={inputClass}
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="например, 82,5"
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
      </Surface>
      <WeightEntry current={me.weight} />
      <SectionLabel>Самочувствие и замеры</SectionLabel>
      <FormView />
    </div>
  );
}
