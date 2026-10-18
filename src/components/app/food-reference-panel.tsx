import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { WheelField } from "@/components/app/wheel-picker";
import { EmptyHint, Field, inputClass, SectionLabel, Surface } from "@/components/app/bits";
import { addManualFoodFn, searchFoodReferenceFn, type ReferenceRow } from "@/lib/food-reference";
import { MANUAL_STATES, STATE_LABEL } from "@/lib/food-reference-manual";
import type { FoodState, Quality } from "@/lib/food-reference-rules";
import { getTelegramInitData } from "@/lib/telegram";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

const QUALITY_NOTE: Record<Quality, string | null> = {
  ok: null,
  incomplete: "неполные данные",
  mismatch: "калории не сходятся с макросами",
};

const REASON_TEXT: Record<string, string> = {
  name: "Название: от 2 до 120 символов.",
  source: "Укажите источник, например «этикетка производителя, 2026».",
  state: "Выберите состояние продукта: сырой, варёный, жареный или сухой.",
  value: "Проверьте значения: калории до 900, белки, жиры и углеводы до 100 г на 100 г.",
  incomplete: "Заполните калории, белки, жиры и углеводы. Пустое значение не считается нулём.",
  macros: "Белки, жиры и углеводы вместе не могут быть больше 100 г на 100 г.",
  full: "Справочник ручных продуктов заполнен.",
  forbidden: "Добавлять продукты может только тренер.",
  "not-allowed": "Нет доступа.",
};

function sourceLine(row: ReferenceRow): string {
  if (row.source === "usda_fdc") return "USDA FoodData Central";
  return row.sourceNote ? `Источник: ${row.sourceNote}` : "Введено вручную";
}

function ReferenceItem({ row }: { row: ReferenceRow }) {
  const note = QUALITY_NOTE[row.quality];
  const stateUnknown = row.state === "unknown";
  return (
    <li className="min-w-0 space-y-1 border-b border-border py-3 last:border-b-0">
      <p className="break-words text-sm font-medium text-foreground">{row.name}</p>
      <p className="break-words text-2xs text-muted-foreground">
        {stateUnknown ? "состояние не указано — в расчёт не войдёт" : STATE_LABEL[row.state]}
        {" · "}
        {row.per100.kcal ?? "—"} ккал · Б {row.per100.protein ?? "—"} · Ж {row.per100.fat ?? "—"} · У {row.per100.carbs ?? "—"}
        {" на 100 г"}
      </p>
      <p className="break-words text-2xs text-muted-foreground">
        {sourceLine(row)}
        {note ? <span className="text-destructive"> · {note}</span> : null}
      </p>
    </li>
  );
}

function AddForm({ onAdded }: { onAdded: (row: ReferenceRow) => void }) {
  const [name, setName] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [state, setState] = useState<FoodState | "">("");
  const [values, setValues] = useState({ kcal: "", protein: "", fat: "", carbs: "", fiber: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    // поля — барабаны, нативный required на них не работает: проверяем сами
    if (!values.kcal || !values.protein || !values.fat || !values.carbs) {
      setError("Заполните калории и Б/Ж/У на 100 г.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await addManualFoodFn({
        data: {
          initData: getTelegramInitData(),
          product: { name, sourceNote, state, per100: values },
        },
      });
      if (!res.ok || !res.row) {
        setError(REASON_TEXT[res.reason ?? ""] ?? "Не удалось сохранить. Попробуйте позже.");
        return;
      }
      onAdded(res.row);
      setName("");
      setSourceNote("");
      setState("");
      setValues({ kcal: "", protein: "", fat: "", carbs: "", fiber: "" });
    } catch {
      setError("Нет связи. Попробуйте позже.");
    } finally {
      setBusy(false);
    }
  }

  const setValue = (key: keyof typeof values) => (value: string) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Название">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
      </Field>
      <Field label="Источник данных (обязательно)">
        <input
          className={inputClass}
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          maxLength={200}
          placeholder="этикетка производителя, таблица, дата"
          required
        />
      </Field>
      <Field label="Состояние продукта">
        <select className={inputClass} value={state} onChange={(e) => setState(e.target.value as FoodState)} required>
          <option value="" disabled>
            выберите
          </option>
          {MANUAL_STATES.map((s) => (
            <option key={s} value={s}>
              {STATE_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
        <Field label="Калории, на 100 г">
          <WheelField label="Калории на 100 г" kind="dec" max={900} start={100} value={values.kcal} onChange={setValue("kcal")} />
        </Field>
        <Field label="Белки, г">
          <WheelField label="Белки на 100 г" kind="dec" unit="г" max={100} start={10} value={values.protein} onChange={setValue("protein")} />
        </Field>
        <Field label="Жиры, г">
          <WheelField label="Жиры на 100 г" kind="dec" unit="г" max={100} start={5} value={values.fat} onChange={setValue("fat")} />
        </Field>
        <Field label="Углеводы, г">
          <WheelField label="Углеводы на 100 г" kind="dec" unit="г" max={100} start={20} value={values.carbs} onChange={setValue("carbs")} />
        </Field>
        <Field label="Клетчатка, г (если известна)">
          <WheelField label="Клетчатка на 100 г" kind="dec" unit="г" max={100} start={2} value={values.fiber} onChange={setValue("fiber")} allowEmpty />
        </Field>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className={cn("h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground", busy && "opacity-60")}
      >
        {busy ? "Сохраняю…" : "Сохранить продукт"}
      </button>
    </form>
  );
}

/** Справочник продуктов: поиск для всех, добавление вручную — только для тренера. */
export function FoodReferencePanel() {
  const isTrainer = useStudio((s) => s.role) === "trainer";
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ReferenceRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setRows([]);
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const timer = setTimeout(async () => {
      try {
        const res = await searchFoodReferenceFn({ data: { initData: getTelegramInitData(), query: text } });
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setRows(res.rows);
        setStatus("idle");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <Surface className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <SectionLabel>Справочник продуктов</SectionLabel>
        {isTrainer ? (
          <button type="button" onClick={() => setAdding((v) => !v)} className="h-11 shrink-0 text-sm text-primary">
            {adding ? "Закрыть" : "Добавить продукт"}
          </button>
        ) : null}
      </div>

      <Field label="Поиск по названию">
        <input
          className={cn(inputClass, "min-w-0")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="например, творог"
          type="search"
        />
      </Field>

      {notice ? <p className="break-words text-sm text-muted-foreground">{notice}</p> : null}

      {status === "error" ? <EmptyHint>Не удалось загрузить справочник. Попробуйте позже.</EmptyHint> : null}
      {status === "loading" ? <EmptyHint>Ищу…</EmptyHint> : null}
      {status === "idle" && query.trim().length >= 2 && rows.length === 0 ? (
        <EmptyHint>Ничего не найдено. Тренер может добавить продукт вручную.</EmptyHint>
      ) : null}
      {status === "idle" && query.trim().length < 2 ? (
        <EmptyHint>Введите хотя бы две буквы названия.</EmptyHint>
      ) : null}
      {rows.length > 0 ? (
        <ul>
          {rows.map((row) => (
            <ReferenceItem key={row.id} row={row} />
          ))}
        </ul>
      ) : null}

      {isTrainer && adding ? (
        <div className="border-t border-border pt-4">
          <AddForm
            onAdded={(row) => {
              setNotice(`Добавлено: ${row.name}. Значения сохранены как введённые тренером.`);
              setAdding(false);
              setQuery(row.name.slice(0, 60));
            }}
          />
        </div>
      ) : null}

      <p className="text-2xs text-muted-foreground">Данные USDA FoodData Central (CC0). Источник каждой записи указан.</p>
    </Surface>
  );
}
