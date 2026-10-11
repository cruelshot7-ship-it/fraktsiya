import { useState, type ReactNode } from "react";
import { addDays, isoDate, MEALS, dayKbju, parseISODate, studioToday, type Booking, type Client } from "@/data/studio";
import {
  buildDayMenu,
  dayStatus,
  dayTotals,
  MEAL_PATTERNS,
  slotTargets,
  type Macro,
} from "@/lib/menu-plan";
import { isMenuStale, menuLogPrefix, pruneDishes, validChoice, type MenuDish, type MenuRecord } from "@/lib/menu-scope";
import { useStudio } from "@/lib/studio-store";
import { specialDataAllowed } from "@/lib/privacy";
import { EmptyHint, SectionLabel, Surface } from "@/components/app/bits";
import { DISH_RECIPES } from "@/data/dish-recipes";
import { cn } from "@/lib/utils";

/** Блюдо из базы в том же виде, что снимок в записи меню. */
function fallbackDish(id: string): MenuDish | undefined {
  const m = MEALS.find((x) => x.id === id);
  return m ? { name: m.name, calories: m.calories, protein: m.protein, fat: m.fat, carbs: m.carbs } : undefined;
}

/** Рецепты всех вариантов записи меню: один сворачиваемый блок, закрыт по умолчанию. */
function RecipeList({ offers }: { offers: Record<string, string[]> }) {
  const ids = [...new Set(Object.values(offers).flat())].filter((id) => DISH_RECIPES[id]);
  if (ids.length === 0) return null;
  return (
    <details className="group rounded-xl bg-card">
      <summary className="pressable flex min-h-11 cursor-pointer list-none items-center justify-between rounded-xl px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Рецепты блюд
        <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-4 px-4 pb-4 pt-1">
        {ids.map((id) => {
          const r = DISH_RECIPES[id];
          return (
            <div key={id}>
              <p className="text-sm font-medium">{fallbackDish(id)?.name ?? id}</p>
              <p className="mt-2 text-tiny text-muted-foreground">Ингредиенты</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {r.ingredients.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-2 text-tiny text-muted-foreground">Приготовление</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
                {r.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** Приём пищи: свёрнут по умолчанию, при нажатии раскрывает варианты. */
function SlotGroup({ label, target, summary, children }: { label: string; target: number; summary: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl bg-card">
      <summary className="pressable flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm">{label}</span>
          <span className="block truncate text-tiny text-muted-foreground">
            ~{target} ккал · {summary}
          </span>
        </span>
        <span aria-hidden className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="px-2 pb-2 pt-1">{children}</div>
    </details>
  );
}

/** Снимок блюда из записи меню; если снимка нет — блюдо из базы. */
const dishOf = (rec: MenuRecord, id: string): MenuDish | undefined => rec.dishes[id] ?? fallbackDish(id);

/** Все блюда записи для подсчёта итогов. Снимки идут последними и перекрывают базу. */
const dishList = (rec: MenuRecord) => [
  ...MEALS,
  ...Object.entries(rec.dishes).map(([id, d]) => ({ id, ...d })),
];

/** Итог выбора клиента против нормы дня. */
function statusLine(totals: Macro, target: Macro) {
  const s = dayStatus(totals, target);
  const kcal = s.kcal === "ok" ? "калории в норме" : s.kcal === "low" ? "калорий мало" : "калорий много";
  const protein = s.protein === "ok" ? "белок в норме" : "белка мало";
  return `${kcal} · ${protein}`;
}

function MenuDayBody({ client, date, bookings }: { client: Client; date: string; bookings: Booking[] }) {
  const role = useStudio((s) => s.role);
  const menus = useStudio((s) => s.menus);
  const food = useStudio((s) => s.food);
  const saveMenu = useStudio((s) => s.saveMenu);
  const setMenuChoice = useStudio((s) => s.setMenuChoice);
  const showToast = useStudio((s) => s.showToast);
  const [count, setCount] = useState<3 | 4 | 5>(3);
  const [askRebuild, setAskRebuild] = useState(false);

  const rec: MenuRecord | null = menus.find((m) => m.clientId === client.id && m.date === date) ?? null;
  const target = dayKbju(client, date, bookings).kbju;
  const slots = rec ? slotTargets(target, MEAL_PATTERNS[rec.count]) : [];

  if (!specialDataAllowed(client.consent)) {
    return (
      <Surface>
        <SectionLabel>Меню дня</SectionLabel>
        <EmptyHint>Питание ведём после согласия клиента на данные о здоровье. Меню не собираем и не показываем.</EmptyHint>
      </Surface>
    );
  }

  if (role === "trainer") {
    const build = () => {
      const built = buildDayMenu(target, count, MEALS);
      if (!built.ok) {
        showToast("Не получилось собрать меню: проверьте норму КБЖУ клиента.");
        return;
      }
      const offers = Object.fromEntries(built.slots.map((s) => [s.id, s.options.map((o) => o.dish.id)]));
      const dishes = Object.fromEntries(
        built.slots.flatMap((s) =>
          s.options.map((o) => [
            o.dish.id,
            { name: o.dish.name, calories: o.dish.calories, protein: o.dish.protein, fat: o.dish.fat, carbs: o.dish.carbs },
          ]),
        ),
      );
      saveMenu({
        id: `${client.id}_${date}`,
        clientId: client.id,
        date,
        count,
        offers,
        dishes,
        choice: {},
        confirmed: false,
        confirmedAt: null,
        targetKcal: Math.round(target.calories),
        updatedAt: new Date().toISOString(),
      });
    };

    const removeOffer = (slotId: string, dishId: string) => {
      if (!rec) return;
      const offers = { ...rec.offers, [slotId]: (rec.offers[slotId] ?? []).filter((d) => d !== dishId) };
      // правка сбрасывает подтверждение: клиент увидит изменённые варианты только после нового подтверждения
      saveMenu({
        ...rec,
        offers,
        dishes: pruneDishes(rec.dishes, offers),
        choice: validChoice(rec.choice, offers),
        confirmed: false,
        confirmedAt: null,
        updatedAt: new Date().toISOString(),
      });
    };

    const confirm = () => {
      if (!rec) return;
      if (isMenuStale(rec, target.calories)) {
        showToast("Норма изменилась. Пересоберите меню перед подтверждением.");
        return;
      }
      const empty = slots.find((s) => (rec.offers[s.id] ?? []).length === 0);
      if (empty) {
        showToast(`Добавьте хотя бы один вариант: ${empty.label.toLowerCase()}.`);
        return;
      }
      const now = new Date().toISOString();
      saveMenu({ ...rec, confirmed: true, confirmedAt: now, updatedAt: now });
      showToast("Меню подтверждено. Клиент видит варианты.");
    };

    const chosen = rec ? dayTotals(rec.choice, slots, dishList(rec)) : null;

    return (
      <Surface glow={rec?.confirmed ? "ok" : undefined}>
        <SectionLabel>Меню дня · норма {Math.round(target.calories)} ккал</SectionLabel>
        {rec && isMenuStale(rec, target.calories) ? (
          <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-tiny text-muted-foreground">
            Норма изменилась: меню собрано на {rec.targetKcal} ккал. Пересоберите меню, прежде чем подтверждать.
          </p>
        ) : null}
        {!rec ? (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1.5">
              {([3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    "pressable h-11 flex-1 rounded-lg text-xs",
                    count === n ? "bg-ok text-ok-foreground lit-ok" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {n} приёма
                </button>
              ))}
            </div>
            <button type="button" onClick={build} className="pressable h-11 w-full rounded-xl bg-secondary text-sm font-medium">
              Собрать варианты из нормы
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {slots.map((slot) => (
              <SlotGroup
                key={slot.id}
                label={slot.label}
                target={Math.round(slot.target.calories)}
                summary={`вариантов: ${(rec.offers[slot.id] ?? []).length}`}
              >
                <ul className="space-y-1.5">
                  {(rec.offers[slot.id] ?? []).map((dishId) => (
                    <li key={dishId} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {dishOf(rec, dishId)?.name ?? dishId}{" "}
                        <span className="text-muted-foreground">· {dishOf(rec, dishId)?.calories ?? 0}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Убрать вариант"
                        onClick={() => removeOffer(slot.id, dishId)}
                        className="pressable size-11 shrink-0 rounded-lg bg-secondary text-muted-foreground"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </SlotGroup>
            ))}
            <RecipeList offers={rec.offers} />
            {rec.confirmed ? (
              <>
                <p className="text-tiny text-ok">
                  Подтверждено. {chosen ? (Object.keys(rec.choice).length ? `Клиент выбрал: ${statusLine(chosen, target)}` : "Клиент ещё не выбрал.") : ""}
                </p>
                {(() => {
                  // дневник клиента за день: сколько записано из меню, сколько — вне меню
                  const day = food.filter((f) => f.clientId === client.id && f.date === date);
                  if (day.length === 0) return null;
                  const fromMenu = day.filter((f) => f.logId.startsWith(menuLogPrefix(rec))).length;
                  const outside = day.filter((f) => !f.logId.startsWith(menuLogPrefix(rec)));
                  const outsideKcal = Math.round(outside.reduce((sum, f) => sum + f.calories, 0));
                  return (
                    <p className="text-tiny text-muted-foreground">
                      В дневнике: из меню {fromMenu} из {slots.length} приёмов · вне меню {outside.length} зап., {outsideKcal} ккал
                    </p>
                  );
                })()}
              </>
            ) : (
              <>
                <p className="text-tiny text-muted-foreground">Клиент не видит меню, пока вы не подтвердите.</p>
                <button type="button" onClick={confirm} className="pressable h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                Подтвердить для клиента
                </button>
              </>
            )}
            {askRebuild ? (
              <div className="space-y-2 rounded-xl bg-card p-3">
                <p className="text-tiny text-muted-foreground">
                  Клиент потеряет подтверждённое меню и свой выбор. Пересобрать?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAskRebuild(false);
                      build();
                    }}
                    className="pressable h-11 rounded-xl bg-secondary text-sm"
                  >
                    Пересобрать
                  </button>
                  <button type="button" onClick={() => setAskRebuild(false)} className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground">
                    Не трогать
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => (rec.confirmed ? setAskRebuild(true) : build())}
                className="pressable h-11 w-full text-tiny text-muted-foreground"
              >
                Пересобрать из нормы
              </button>
            )}
          </div>
        )}
      </Surface>
    );
  }

  // клиент
  if (rec && rec.confirmed && isMenuStale(rec, target.calories)) {
    return (
      <Surface>
        <SectionLabel>Меню дня</SectionLabel>
        <EmptyHint>Тренер обновит меню под новую норму.</EmptyHint>
      </Surface>
    );
  }
  if (!rec || !rec.confirmed) {
    return (
      <Surface>
        <SectionLabel>Меню дня</SectionLabel>
        <EmptyHint>Тренер ещё не подтвердил меню на этот день.</EmptyHint>
      </Surface>
    );
  }

  const chosen = dayTotals(rec.choice, slots, dishList(rec));
  const complete = slots.every((s) => rec.choice[s.id]);

  return (
    <Surface glow={complete ? "ok" : undefined}>
      <SectionLabel>Меню дня · выберите по одному блюду</SectionLabel>
      <div className="mt-3 space-y-3">
        {slots.map((slot) => {
          const chosenId = rec.choice[slot.id];
          const chosenName = chosenId ? (dishOf(rec, chosenId)?.name ?? chosenId) : "не выбрано";
          return (
            <SlotGroup key={slot.id} label={slot.label} target={Math.round(slot.target.calories)} summary={chosenName}>
              <div className="flex flex-col gap-1.5">
                {(rec.offers[slot.id] ?? []).map((dishId) => {
                  const active = rec.choice[slot.id] === dishId;
                  return (
                    <button
                      key={dishId}
                      type="button"
                      onClick={() => setMenuChoice(client.id, date, slot.id, dishId)}
                      aria-pressed={active}
                      className={cn(
                        "pressable flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm",
                        active ? "bg-ok-dim text-foreground lit-ok" : "bg-card text-muted-foreground",
                      )}
                    >
                      <span className="min-w-0 truncate">{dishOf(rec, dishId)?.name ?? dishId}</span>
                      <span className="shrink-0 text-tiny">{dishOf(rec, dishId)?.calories ?? 0} ккал</span>
                    </button>
                  );
                })}
              </div>
            </SlotGroup>
          );
        })}
        <p className="text-tiny text-muted-foreground">
          {Object.keys(rec.choice).length
            ? `Выбрано: ${Math.round(chosen.calories)} ккал из ${Math.round(target.calories)} · ${statusLine(chosen, target)}`
            : "Выберите блюдо на каждый приём."}
        </p>
        <RecipeList offers={rec.offers} />
      </div>
    </Surface>
  );
}

const dateLabel = (iso: string) =>
  parseISODate(iso).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });

/** День питания с переключением даты. Тренер и клиент смотрят одно и то же меню на выбранный день. */
export function MenuDay({ client, bookings }: { client: Client; bookings: Booking[] }) {
  const [date, setDate] = useState(() => studioToday());
  const isToday = date === studioToday();
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Предыдущий день"
          onClick={() => setDate(isoDate(addDays(parseISODate(date), -1)))}
          className="pressable size-11 rounded-lg bg-secondary text-muted-foreground"
        >
          ‹
        </button>
        <p className="min-w-0 truncate text-sm">
          {dateLabel(date)}
          {isToday ? <span className="text-muted-foreground"> · сегодня</span> : null}
        </p>
        <div className="flex gap-1.5">
          {!isToday ? (
            <button type="button" onClick={() => setDate(studioToday())} className="pressable h-11 rounded-lg bg-secondary px-2.5 text-tiny">
              Сегодня
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Следующий день"
            onClick={() => setDate(isoDate(addDays(parseISODate(date), 1)))}
            className="pressable size-11 rounded-lg bg-secondary text-muted-foreground"
          >
            ›
          </button>
        </div>
      </div>
      <MenuDayBody client={client} date={date} bookings={bookings} />
    </>
  );
}
