import { useMemo, useState } from "react";
import { ScanLine } from "lucide-react";
import { addDays, dayKbju, formatDayMonth, isoDate, MEALS, parseISODate, studioToday, sumFood, type Client, type FoodLog, type Meal } from "@/data/studio";
import { scaleKbju, type ScanProduct } from "@/data/scan";
import { activeClient, useStudio } from "@/lib/studio-store";
import { specialDataAllowed } from "@/lib/privacy";
import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";
import { MenuDay } from "@/components/app/menu-day";
import { FEATURES } from "@/lib/features";
import { ScannerSheet } from "@/components/app/scanner-sheet";
import { FoodReferencePanel } from "@/components/app/food-reference-panel";
import { FoodCalendar, shiftIso } from "@/components/app/food-calendar";
import { WheelField } from "@/components/app/wheel-picker";
import { cn } from "@/lib/utils";

type Slot = "all" | "breakfast" | "lunch" | "dinner" | "snack";
type AddTab = "dishes" | "scan" | "own";

const SLOT_LABEL: Record<Slot, string> = {
  all: "Все",
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

const ADD_TABS: { id: AddTab; label: string }[] = [
  { id: "dishes", label: "Блюда" },
  { id: "scan", label: "Скан" },
  { id: "own", label: "Своё" },
];

/** Порядок приёмов в дневнике. Записи без приёма идут последними. */
const DIARY_GROUPS: { key: string; label: string }[] = [
  { key: "breakfast", label: "Завтрак" },
  { key: "lunch", label: "Обед" },
  { key: "dinner", label: "Ужин" },
  { key: "snack", label: "Перекус" },
  { key: "other", label: "Без приёма" },
];

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

/** Вкладка «Еда». Хуки живут во внутреннем компоненте: ранний возврат без клиента не меняет их порядок. */
export function NutritionView() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const client = activeClient({ clients, activeClientId });
  if (!client) {
    return <EmptyHint>Питание откроется, когда тренер заведёт ваш профиль и КБЖУ.</EmptyHint>;
  }
  return <NutritionContent client={client} />;
}

function NutritionContent({ client }: { client: Client }) {
  const food = useStudio((s) => s.food);
  const menus = useStudio((s) => s.menus);
  const addFood = useStudio((s) => s.addFood);
  const addCustomFood = useStudio((s) => s.addCustomFood);
  const removeFood = useStudio((s) => s.removeFood);
  const bookings = useStudio((s) => s.bookings);
  const showToast = useStudio((s) => s.showToast);
  const [addOpen, setAddOpen] = useState(false);
  const [addTab, setAddTab] = useState<AddTab>("dishes");
  const [query, setQuery] = useState("");
  const [slot, setSlot] = useState<Slot>("all");
  const [scanOpen, setScanOpen] = useState(false);
  const [name, setName] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [carbs, setCarbs] = useState("");
  /** день дневника: по умолчанию сегодня, меняется календарём */
  const [day, setDay] = useState(() => studioToday());
  const [calOpen, setCalOpen] = useState(false);

  const today = studioToday();
  const tomorrow = isoDate(addDays(parseISODate(today), 1));
  const tomorrowReady = menus.some((m) => m.clientId === client.id && m.date === tomorrow && m.confirmed);
  const dayFood = food.filter((f) => f.date === day && f.clientId === client.id);
  const isToday = day === today;
  const dayLabel = isToday ? "Сегодня" : formatDayMonth(day);
  /** дни с записями — точка в календаре */
  const foodDays = useMemo(() => new Set(food.filter((f) => f.clientId === client.id).map((f) => f.date)), [food, client.id]);
  const prevDay = shiftIso(day, -1);
  const prevFood = useMemo(
    () => food.filter((f) => f.clientId === client.id && f.date === prevDay),
    [food, client.id, prevDay],
  );
  /** записи пишутся в выбранный день дневника */
  const addOnDay = (meal: Omit<Meal, "id">) => addCustomFood(meal, day);

  const totals = sumFood(dayFood);
  const goal = dayKbju(client, day, bookings);
  const hasGoal = goal.kbju.calories > 0;
  const overCal = Math.max(0, totals.calories - (goal.kbju.calories || 0));
  const leftCal = Math.max(0, (goal.kbju.calories || 0) - totals.calories);
  const leftP = Math.max(0, (goal.kbju.protein || 0) - totals.protein);
  const low = totals.calories > 0 && hasGoal && totals.calories < goal.kbju.calories * 0.72;

  const groups = DIARY_GROUPS.map((g) => {
    const items = dayFood.filter((f) => (f.kind ?? "other") === g.key);
    return { ...g, items, kcal: items.reduce((sum, f) => sum + f.calories, 0) };
  }).filter((g) => g.items.length > 0);

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

  function repeatPrevDay() {
    const prevLabel = isToday ? "вчера" : formatDayMonth(prevDay);
    if (!prevFood.length) {
      showToast(`${isToday ? "Вчера" : formatDayMonth(prevDay)}: записей еды не было`);
      return;
    }
    for (const entry of prevFood) {
      addOnDay({
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        kind: entry.kind,
      });
    }
    showToast(`Повторено с ${prevLabel} · ${prevFood.length} поз.`);
  }

  function addScanned(product: ScanProduct, grams: number) {
    const macros = scaleKbju(product.per100, grams);
    addOnDay({
      name: `${product.name} · ${grams} г`,
      calories: macros.calories,
      protein: macros.protein,
      fat: macros.fat,
      carbs: macros.carbs,
    });
    setScanOpen(false);
    setAddOpen(false);
  }

  function pick(mealId: string) {
    addFood(mealId, day);
    const meal = MEALS.find((m) => m.id === mealId);
    showToast(meal ? `+ ${meal.name}` : "Добавлено");
  }

  function addOwn() {
    if (!name.trim() || !Number(cal)) {
      showToast("Укажите название и калории");
      return;
    }
    addOnDay({
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
    setAddOpen(false);
    showToast("Добавлено в дневник");
  }

  if (!specialDataAllowed(client.consent)) {
    return (
      <Surface>
        <SectionLabel>Питание</SectionLabel>
        <EmptyHint>Питание ведём после согласия на данные о здоровье. Дать согласие: «Профиль» → «Мои данные».</EmptyHint>
      </Surface>
    );
  }

  return (
    <div className="stagger-in relative flex flex-col gap-3">
      {/* 1. День одним блоком: цифры и одна честная строка статуса */}
      <Surface glow={low ? "alert" : "ok"}>
        <KbjuMeters title={`${dayLabel} · ${goal.train ? "тренировка" : "отдых"}`} eaten={totals} target={goal.kbju} />
        <p className={cn("mt-3 text-tiny", overCal > 0 ? "text-destructive" : "text-muted-foreground")}>
          {!hasGoal
            ? "Цель КБЖУ ещё не задана — тренер укажет её."
            : overCal > 0
              ? `Перебор ${overCal} ккал`
              : `Осталось ${leftCal} ккал · белка ${leftP} г`}
        </p>
      </Surface>

      {FEATURES.menuDay && tomorrowReady ? (
        <p className="px-1 text-tiny text-muted-foreground">Меню на завтра готово: листайте дату в блоке ниже ›</p>
      ) : null}

      {/* 2. Меню дня от тренера */}
      {FEATURES.menuDay ? <MenuDay client={client} bookings={bookings} /> : null}

      {/* 3. Дневник по приёмам с подытогом */}
      <Surface>
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>Дневник</SectionLabel>
          <div className="flex items-center gap-1">
            {prevFood.length > 0 ? (
              <button type="button" onClick={repeatPrevDay} className="pressable h-9 px-2 text-tiny text-muted-foreground">
                Повторить {isToday ? "вчера" : formatDayMonth(prevDay)} · {prevFood.length}
              </button>
            ) : null}
            <button
              type="button"
              aria-expanded={calOpen}
              onClick={() => setCalOpen((open) => !open)}
              className="pressable h-9 rounded-lg bg-secondary px-3 text-tiny"
            >
              {dayLabel} · календарь
            </button>
          </div>
        </div>
        {calOpen ? (
          <div className="mt-3">
            <FoodCalendar
              value={day}
              today={today}
              marks={foodDays}
              onChange={(iso) => {
                setDay(iso);
                setCalOpen(false);
              }}
            />
          </div>
        ) : null}
        {groups.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Пока пусто. Добавьте первое блюдо кнопкой ниже.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.key} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between text-tiny text-muted-foreground">
                  <span>{group.label}</span>
                  <span className="tabular-nums">{group.kcal} ккал</span>
                </div>
                {group.items.map((entry: FoodLog) => (
                  <div key={entry.logId} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{entry.name}</p>
                      <p className="text-tiny text-muted-foreground tabular-nums">
                        {entry.calories} ккал · <span className="text-protein">Б {entry.protein}</span>{" "}
                        <span className="text-fat">Ж {entry.fat}</span> <span className="text-carb">У {entry.carbs}</span>
                      </p>
                    </div>
                    {entry.logId.startsWith("menu_") ? (
                      // блюдо из меню убирается выбором в меню дня, иначе журнал и выбор расходятся
                      <span className="text-tiny text-muted-foreground">из меню</span>
                    ) : (
                      <button type="button" onClick={() => removeFood(entry.logId)} className="h-11 px-2 text-tiny text-muted-foreground">
                        Убрать
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </Surface>

      {/* 4. Одна точка входа для добавления: блюда, скан или своё */}
      <button
        type="button"
        onClick={() => setAddOpen((open) => !open)}
        aria-expanded={addOpen}
        className="pressable flex h-14 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
      >
        {addOpen ? "Закрыть" : "+ Добавить еду"}
      </button>

      {addOpen ? (
        <Surface>
          <div role="tablist" className="flex gap-1 rounded-full bg-secondary p-1">
            {ADD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={addTab === tab.id}
                onClick={() => setAddTab(tab.id)}
                className={cn(
                  "pressable h-8 min-w-0 flex-1 truncate rounded-full px-1 text-2xs font-medium",
                  addTab === tab.id ? "bg-background text-foreground" : "text-muted-foreground",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {addTab === "dishes" ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1">
                {(Object.keys(SLOT_LABEL) as Slot[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSlot(id)}
                    className={cn(
                      "pressable h-8 rounded-full px-3 text-2xs font-medium",
                      slot === id ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {SLOT_LABEL[id]}
                  </button>
                ))}
              </div>
              <input className={inputClass} placeholder="Найти блюдо" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-2">
                {suggestions.length === 0 ? (
                  <p className="col-span-2 py-4 text-sm text-muted-foreground">Ничего не нашли. Смените приём или поиск.</p>
                ) : (
                  suggestions.map((meal) => {
                    const fits = !hasGoal || meal.calories <= leftCal + 80;
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => pick(meal.id)}
                        className={cn("pressable flex min-w-0 flex-col gap-1 rounded-xl bg-card px-2.5 py-2.5 text-left shadow-border", fits ? "" : "opacity-70")}
                      >
                        <span className="line-clamp-2 text-2xs font-medium leading-snug">{meal.name}</span>
                        <span className="text-2xs tabular-nums text-muted-foreground">
                          {meal.calories} ккал · <span className="text-protein">Б{meal.protein}</span>
                        </span>
                        {fits ? <span className="text-2xs font-medium text-ok">в цель</span> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {addTab === "scan" ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-tiny text-muted-foreground">Наведите камеру на штрихкод или QR. Вес укажете перед добавлением.</p>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="pressable flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary text-sm font-medium"
              >
                <ScanLine className="size-5" />
                Открыть сканер
              </button>
            </div>
          ) : null}

          {addTab === "own" ? (
            <div className="mt-3 flex flex-col gap-2">
              <Field label="Название">
                <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Гречка с фаршем" />
              </Field>
              <div className="grid grid-cols-[repeat(4,minmax(0,1fr))] gap-2">
                <Field label="ккал">
                  <WheelField label="Калории, ккал" value={cal} onChange={setCal} max={2000} step={5} start={300} allowEmpty />
                </Field>
                <Field label="Б">
                  <WheelField label="Белки, г" value={protein} onChange={setProtein} unit="г" max={300} start={20} allowEmpty />
                </Field>
                <Field label="Ж">
                  <WheelField label="Жиры, г" value={fat} onChange={setFat} unit="г" max={300} start={10} allowEmpty />
                </Field>
                <Field label="У">
                  <WheelField label="Углеводы, г" value={carbs} onChange={setCarbs} unit="г" max={300} start={30} allowEmpty />
                </Field>
              </div>
              <button type="button" className="pressable h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={addOwn}>
                Добавить в дневник
              </button>
            </div>
          ) : null}
        </Surface>
      ) : null}

      <FoodReferencePanel />

      {scanOpen ? (
        <div className="fixed inset-0 z-[80] bg-background">
          <ScannerSheet onClose={() => setScanOpen(false)} onAdd={addScanned} />
        </div>
      ) : null}
    </div>
  );
}
