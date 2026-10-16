import { specialDataAllowed } from "@/lib/privacy";
import { WheelField } from "@/components/app/wheel-picker";
import { useState } from "react";
import { isoDate } from "@/data/studio";
import { changeSinceFirst, latestValue, MEASURE_FIELDS, type MeasureInput } from "@/lib/body-measures";
import type { Client } from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { Field, inputClass, SectionLabel, Surface } from "@/components/app/bits";

/** Русская запись дроби: 40.5 → "40,5". */
const formatCm = (value: number) => String(value).replace(".", ",");

/** Client side: enter today's measurements in cm. */
export function MeasuresCard({ client }: { client: Client }) {
  const saveMeasure = useStudio((s) => s.saveMeasure);
  const showToast = useStudio((s) => s.showToast);
  const [values, setValues] = useState<MeasureInput>({});
  const measures = client.measures ?? [];
  const today = isoDate(new Date());
  const todayRow = measures.find((m) => m.date === today);

  if (!specialDataAllowed(client.consent)) {
    return (
      <Surface>
        <SectionLabel>Замеры, см</SectionLabel>
        <p className="mt-2 text-tiny text-muted-foreground">
          Замеры тела ведём только с согласия. Дать или отозвать его можно в «Профиль» → «Мои данные».
        </p>
      </Surface>
    );
  }

  return (
    <Surface>
      <SectionLabel>Замеры, см</SectionLabel>
      <p className="mt-1 text-tiny text-muted-foreground">
        Заполните то, что измерили сегодня. Остальное можно оставить пустым.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MEASURE_FIELDS.map((field) => {
          const last = latestValue(measures, field.key);
          return (
            <Field key={field.key} label={last ? `${field.label} (${formatCm(last.value)})` : field.label}>
              <WheelField
                label={field.label}
                kind="dec"
                unit="см"
                min={20}
                max={200}
                start={last ? last.value : 80}
                value={values[field.key] ?? ""}
                onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
                allowEmpty
              />
              {todayRow?.[field.key] !== undefined ? (
                <span className="text-tiny text-muted-foreground">сегодня: {formatCm(todayRow[field.key] as number)}</span>
              ) : null}
            </Field>
          );
        })}
      </div>
      <button
        type="button"
        className="pressable mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => {
          const error = saveMeasure(values);
          if (error) {
            showToast(error);
            return;
          }
          setValues({});
          showToast("Замеры сохранены");
        }}
      >
        Сохранить замеры
      </button>
    </Surface>
  );
}

/** Trainer side: latest value and change since the first record, per field. */
export function MeasuresSummary({ client }: { client: Client }) {
  // the trainer sees measures only where the client gave the special-data consent (same gate as the client's own view)
  if (!specialDataAllowed(client.consent)) {
    return <p className="text-sm text-muted-foreground">Клиент не дал согласия на замеры. Данные скрыты.</p>;
  }
  const measures = client.measures ?? [];
  if (!measures.length) {
    return <p className="text-sm text-muted-foreground">Клиент ещё не вносил замеры.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {MEASURE_FIELDS.map((field) => {
        const last = latestValue(measures, field.key);
        if (!last) return null;
        const change = changeSinceFirst(measures, field.key);
        return (
          <div key={field.key} className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">{field.label}</span>
            <span className="tabular-nums">
              {last.value} см
              {change !== null ? (
                <span className="ml-2 text-xs text-muted-foreground">
                  {change > 0 ? "+" : ""}
                  {change}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
