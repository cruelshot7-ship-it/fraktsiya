import { useState } from "react";
import { ScanLine } from "lucide-react";
import { isoDate, MEALS, sumFood } from "@/data/studio";
import { scaleKbju, type ScanProduct } from "@/data/scan";
import { activeClient, useStudio } from "@/lib/studio-store";
import { Field, inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { ScannerSheet } from "@/components/app/scanner-sheet";

export function NutritionView() {
  const food = useStudio((s) => s.food);
  const addFood = useStudio((s) => s.addFood);
  const addCustomFood = useStudio((s) => s.addCustomFood);
  const removeFood = useStudio((s) => s.removeFood);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const client = activeClient({ clients, activeClientId });
  const [query, setQuery] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  if (!client) {
    return <EmptyHint>Питание откроется, когда тренер заведёт ваш профиль и КБЖУ.</EmptyHint>;
  }
  const today = isoDate(new Date());
  const todayFood = food.filter((f) => f.date === today && f.clientId === client.id);
  const totals = sumFood(todayFood);

  const filtered = MEALS.filter((m) => m.name.toLowerCase().includes(query.trim().toLowerCase()));
  const low = totals.calories > 0 && totals.calories < client.kbju.calories * 0.72;

  function addScanned(product: ScanProduct, grams: number) {
    const macros = scaleKbju(product.per100, grams);
    addCustomFood({
      name: `${product.name} · ${grams} г`,
      calories: macros.calories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
    });
    setScanOpen(false);
  }

  return (
    <div className="stagger-in relative flex flex-col gap-3">
      <Surface glow={low ? "alert" : "ok"}>
        <SectionLabel>Сегодня · цель {client.firstName}</SectionLabel>
        <p className="font-display mt-2 text-3xl tabular-nums">
          {totals.calories}
          <span className="ml-1 text-base text-muted-foreground">/ {client.kbju.calories} ккал</span>
        </p>
        <div className="mt-3">
          <ProgressRail value={totals.calories} max={client.kbju.calories} tone={low ? "alert" : "ok"} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-tiny text-muted-foreground">
          <span>Б {totals.protein}/{client.kbju.protein}</span>
          <span>Ж {totals.fat}/{client.kbju.fat}</span>
          <span>У {totals.carbs}/{client.kbju.carbs}</span>
        </div>
      </Surface>

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="pressable flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-glow-alert"
      >
        <ScanLine className="size-5" />
        Сканировать штрихкод / QR
      </button>
      <p className="text-tiny text-muted-foreground">
        Как в Mist: камера, фото или цифры. Open Food Facts + каталог студии. Каталог обновляется без пересборки. Если базы нет — заведём товар сами, дневник не встанет.
      </p>

      {todayFood.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Дневник</SectionLabel>
          {todayFood.map((entry) => (
            <Surface key={entry.logId} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="text-sm">{entry.name}</p>
                <p className="text-tiny text-muted-foreground">
                  {entry.calories} ккал · Б {entry.protein} Ж {entry.fat} У {entry.carbs}
                </p>
              </div>
              <button type="button" onClick={() => removeFood(entry.logId)} className="h-10 px-2 text-xs text-muted-foreground">
                Убрать
              </button>
            </Surface>
          ))}
        </div>
      ) : null}

      <div>
        <SectionLabel>Добавить как в дневнике</SectionLabel>
        <input
          className={`${inputClass} mt-3`}
          placeholder="Найти блюдо…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          {filtered.map((meal) => (
            <button
              key={meal.id}
              type="button"
              onClick={() => addFood(meal.id)}
              className="pressable rounded-xl bg-card px-3 py-3 text-left shadow-border"
            >
              <span className="block text-sm font-medium">{meal.name}</span>
              <span className="mt-1 block text-tiny text-muted-foreground">
                {meal.calories} ккал · Б {meal.protein}
              </span>
            </button>
          ))}
        </div>
      </div>

      <Surface>
        <button type="button" className="flex w-full items-center justify-between" onClick={() => setCustomOpen((v) => !v)}>
          <SectionLabel>Своё блюдо</SectionLabel>
          <span className="text-tiny text-muted-foreground">{customOpen ? "свернуть" : "ввести КБЖУ"}</span>
        </button>
        {customOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            <Field label="Название">
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Гречка с фаршем" />
            </Field>
            <div className="grid grid-cols-4 gap-2">
              <Field label="ккал">
                <input className={inputClass} inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} />
              </Field>
              <Field label="Б">
                <input className={inputClass} inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} />
              </Field>
              <Field label="Ж">
                <input className={inputClass} inputMode="numeric" value={fat} onChange={(e) => setFat(e.target.value)} />
              </Field>
              <Field label="У">
                <input className={inputClass} inputMode="numeric" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
              </Field>
            </div>
            <button
              type="button"
              className="pressable h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => {
                if (!name.trim() || !Number(cal)) return;
                addCustomFood({
                  name: name.trim(),
                  calories: Number(cal) || 0,
                  protein: Number(protein) || 0,
                  fat: Number(fat) || 0,
                  carbs: Number(carbs) || 0,
                });
                setName("");
                setCal("");
                setProtein("");
                setFat("");
                setCarbs("");
              }}
            >
              Добавить в дневник
            </button>
          </div>
        ) : null}
      </Surface>

      <Surface>
        <SectionLabel>Фото тарелки</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Разбор еды по фото — следующий этап. Штрихкод уже работает: это точнее, чем угадывать с кадра.
        </p>
      </Surface>

      {scanOpen ? <ScannerSheet onClose={() => setScanOpen(false)} onAdd={addScanned} /> : null}
    </div>
  );
}
