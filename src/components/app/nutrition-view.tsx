import { useMemo, useState } from "react";
import { ScanLine } from "lucide-react";
import { addDays, dayKbju, isoDate, MEALS, parseISODate, sumFood, type Meal } from "@/data/studio";
import { scaleKbju, type ScanProduct } from "@/data/scan";
import { activeClient, useStudio } from "@/lib/studio-store";
import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { ScannerSheet } from "@/components/app/scanner-sheet";
import { cn } from "@/lib/utils";

type Slot = "all" | "breakfast" | "lunch" | "dinner" | "snack";

const SLOT_LABEL: Record<Slot, string> = {
  all: "Все",
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

function hourSlot(h: number): Slot {
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  if (h < 21) return "dinner";
  return "snack";
}

/** Prefer meals that fit remaining macros (cal + protein). */
function rankMeals(meals: Meal[], leftCal: number, leftP: number): Meal[] {
  const scored = meals.map((m) => {
    let score = 0;
    if (leftCal > 0) {
      if (m.calories <= leftCal) score += 40 + (1 - Math.abs(m.calories - leftCal * 0.35) / Math.max(leftCal, 1)) * 30;
      else score -= 20 + (m.calories - leftCal) / 50;
    } else {
      score += m.calories < 400 ? 10 : -10;
    }
    if (leftP > 0) {
      if (m.protein <= leftP + 15) score += 25 + (Math.min(m.protein, leftP) / Math.max(leftP, 1)) * 20;
      else score += 5;
    }
    return { m, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.m);
}

export function NutritionView() {
  const food = useStudio((s) => s.food);
  const addFood = useStudio((s) => s.addFood);
  const addCustomFood = useStudio((s) => s.addCustomFood);
  const removeFood = useStudio((s) => s.removeFood);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const showToast = useStudio((s) => s.showToast);
  const client = activeClient({ clients, activeClientId });
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<Slot>("all");
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

  const yesterday = isoDate(addDays(parseISODate(today), -1));
  const yesterdayFood = useMemo(
    () => (client ? food.filter((f) => f.clientId === client.id && f.date === yesterday) : []),
    [client, food, yesterday],
  );

  function repeatYesterday() {
    if (!yesterdayFood.length) {
      showToast("Вчера записей еды не было");
      return;
    }
    for (const entry of yesterdayFood) {
      addCustomFood({
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        kind: entry.kind,
      });
    }
    showToast(`Повторено вчера · ${yesterdayFood.length} поз.`);
  }
  const totals = sumFood(todayFood);
  const goal = dayKbju(client, today, bookings);
  const leftCal = Math.max(0, (goal.kbju.calories || 0) - totals.calories);
  const leftP = Math.max(0, (goal.kbju.protein || 0) - totals.protein);
  const hasGoal = goal.kbju.calories > 0;

  const low = totals.calories > 0 && goal.kbju.calories > 0 && totals.calories < goal.kbju.calories * 0.72;

  const suggestions = useMemo(() => {
    let pool = MEALS;
    if (slot !== "all") {
      const tagged = pool.some((m) => m.kind);
      if (tagged) pool = pool.filter((m) => (m.kind ?? slot) === slot);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter((m) => m.name.toLowerCase().includes(q));
    }
    return rankMeals(pool, hasGoal ? leftCal : 2000, hasGoal ? leftP : 150).slice(0, 8);
  }, [slot, query, leftCal, leftP, hasGoal]);

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

  function pick(mealId: string) {
    addFood(mealId);
    const meal = MEALS.find((m) => m.id === mealId);
    showToast(meal ? `+ ${meal.name}` : "Добавлено");
  }

  return (
    <div className="stagger-in relative flex flex-col gap-3">
      <Surface glow={low ? "alert" : "ok"}>
        <KbjuMeters
          title={`Сегодня · ${goal.train ? "тренировка" : "отдых"}`}
          eaten={totals}
          target={goal.kbju}
        />
        {hasGoal ? (
          <p className="mt-3 text-tiny text-muted-foreground">
            Осталось ≈ {leftCal} ккал · Б {leftP} г — конструктор подбирает из меню.
          </p>
        ) : (
          <p className="mt-3 text-tiny text-muted-foreground">
            Цель КБЖУ ещё не задана — ниже варианты из меню зала.
          </p>
        )}
      </Surface>

      <Surface>
        <SectionLabel>Конструктор · меню зала</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-1">
          {(Object.keys(SLOT_LABEL) as Slot[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setSlot(id)}
              className={cn(
                "pressable h-8 rounded-full px-3 text-xs font-medium",
                slot === id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              {SLOT_LABEL[id]}
            </button>
          ))}
        </div>
        <input
          className={`${inputClass} mt-3`}
          placeholder="Найти в меню…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {suggestions.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Нет вариантов — смените приём пищи или поиск.</p>
          ) : (
            suggestions.map((meal) => {
              const fits = !hasGoal || meal.calories <= leftCal + 80;
              return (
                <button
                  key={meal.id}
                  type="button"
                  onClick={() => pick(meal.id)}
                  className={cn(
                    "pressable flex flex-col gap-1 rounded-xl bg-card px-2.5 py-2.5 text-left shadow-border",
                    fits ? "" : "opacity-70",
                  )}
                >
                  <span className="line-clamp-2 text-xs font-medium leading-snug">{meal.name}</span>
                  <span className="text-2xs tabular-nums text-muted-foreground">
                    {meal.calories} ккал · Б{meal.protein}
                  </span>
                  <span className={cn("text-2xs font-medium", fits ? "text-ok" : "text-muted-foreground")}>
                    {fits ? "В цель · +" : "+"}
                  </span>
                </button>
              );
            })
          )}
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

      {yesterdayFood.length > 0 ? (
        <button
          type="button"
          onClick={repeatYesterday}
          className="pressable flex h-11 items-center justify-center rounded-xl bg-secondary text-sm font-medium"
        >
          Повторить вчера · {yesterdayFood.length} поз.
        </button>
      ) : null}

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
                showToast("Добавлено в дневник");
              }}
            >
              Добавить в дневник
            </button>
          </div>
        ) : null}
      </Surface>

      {scanOpen ? (
        <div className="fixed inset-0 z-[80] bg-background">
          <ScannerSheet onClose={() => setScanOpen(false)} onAdd={addScanned} />
        </div>
      ) : null}
    </div>
  );
}
