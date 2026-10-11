import { useState } from "react";
import { addDays, isoDate, MEALS, dayKbju, parseISODate, type Booking, type Client } from "@/data/studio";
import {
  buildDayMenu,
  dayStatus,
  dayTotals,
  MEAL_PATTERNS,
  slotTargets,
  type Macro,
} from "@/lib/menu-plan";
import { validChoice, type MenuRecord } from "@/lib/menu-scope";
import { useStudio } from "@/lib/studio-store";
import { specialDataAllowed } from "@/lib/privacy";
import { EmptyHint, SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";

const dishName = (id: string) => MEALS.find((m) => m.id === id)?.name ?? id;
const dishKcal = (id: string) => MEALS.find((m) => m.id === id)?.calories ?? 0;

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
  const saveMenu = useStudio((s) => s.saveMenu);
  const setMenuChoice = useStudio((s) => s.setMenuChoice);
  const showToast = useStudio((s) => s.showToast);
  const [count, setCount] = useState<3 | 4 | 5>(3);

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
      saveMenu({
        id: `${client.id}_${date}`,
        clientId: client.id,
        date,
        count,
        offers,
        choice: {},
        confirmed: false,
        updatedAt: new Date().toISOString(),
      });
    };

    const removeOffer = (slotId: string, dishId: string) => {
      if (!rec) return;
      const offers = { ...rec.offers, [slotId]: (rec.offers[slotId] ?? []).filter((d) => d !== dishId) };
      // правка сбрасывает подтверждение: клиент увидит изменённые варианты только после нового подтверждения
      saveMenu({ ...rec, offers, choice: validChoice(rec.choice, offers), confirmed: false, updatedAt: new Date().toISOString() });
    };

    const confirm = () => {
      if (!rec) return;
      const empty = slots.find((s) => (rec.offers[s.id] ?? []).length === 0);
      if (empty) {
        showToast(`Добавьте хотя бы один вариант: ${empty.label.toLowerCase()}.`);
        return;
      }
      saveMenu({ ...rec, confirmed: true, updatedAt: new Date().toISOString() });
      showToast("Меню подтверждено. Клиент видит варианты.");
    };

    const chosen = rec ? dayTotals(rec.choice, slots, MEALS) : null;

    return (
      <Surface glow={rec?.confirmed ? "ok" : undefined}>
        <SectionLabel>Меню дня · норма {Math.round(target.calories)} ккал</SectionLabel>
        {!rec ? (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1.5">
              {([3, 4, 5] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={cn(
                    "pressable h-9 flex-1 rounded-lg text-xs",
                    count === n ? "bg-primary text-primary-foreground lit-red" : "bg-secondary text-muted-foreground",
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
              <div key={slot.id}>
                <p className="text-tiny text-muted-foreground">
                  {slot.label} · ~{slot.target.calories} ккал
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {(rec.offers[slot.id] ?? []).map((dishId) => (
                    <li key={dishId} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        {dishName(dishId)} <span className="text-muted-foreground">· {dishKcal(dishId)}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Убрать вариант"
                        onClick={() => removeOffer(slot.id, dishId)}
                        className="pressable size-8 shrink-0 rounded-lg bg-secondary text-muted-foreground"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {rec.confirmed ? (
              <p className="text-tiny text-ok">
                Подтверждено. {chosen ? (Object.keys(rec.choice).length ? `Клиент выбрал: ${statusLine(chosen, target)}` : "Клиент ещё не выбрал.") : ""}
              </p>
            ) : (
              <button type="button" onClick={confirm} className="pressable h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
                Подтвердить для клиента
              </button>
            )}
            <button type="button" onClick={build} className="pressable h-9 w-full text-tiny text-muted-foreground">
              Пересобрать из нормы
            </button>
          </div>
        )}
      </Surface>
    );
  }

  // клиент
  if (!rec || !rec.confirmed) {
    return (
      <Surface>
        <SectionLabel>Меню дня</SectionLabel>
        <EmptyHint>Тренер ещё не подтвердил меню на этот день.</EmptyHint>
      </Surface>
    );
  }

  const chosen = dayTotals(rec.choice, slots, MEALS);
  const complete = slots.every((s) => rec.choice[s.id]);

  return (
    <Surface glow={complete ? "ok" : undefined}>
      <SectionLabel>Меню дня · выберите по одному блюду</SectionLabel>
      <div className="mt-3 space-y-3">
        {slots.map((slot) => (
          <div key={slot.id}>
            <p className="text-tiny text-muted-foreground">
              {slot.label} · ~{slot.target.calories} ккал
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
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
                    <span className="min-w-0 truncate">{dishName(dishId)}</span>
                    <span className="shrink-0 text-tiny">{dishKcal(dishId)} ккал</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-tiny text-muted-foreground">
          {Object.keys(rec.choice).length
            ? `Выбрано: ${Math.round(chosen.calories)} ккал из ${Math.round(target.calories)} · ${statusLine(chosen, target)}`
            : "Выберите блюдо на каждый приём."}
        </p>
      </div>
    </Surface>
  );
}

const dateLabel = (iso: string) =>
  parseISODate(iso).toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "long" });

/** День питания с переключением даты. Тренер и клиент смотрят одно и то же меню на выбранный день. */
export function MenuDay({ client, bookings }: { client: Client; bookings: Booking[] }) {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const isToday = date === isoDate(new Date());
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Предыдущий день"
          onClick={() => setDate(isoDate(addDays(parseISODate(date), -1)))}
          className="pressable size-9 rounded-lg bg-secondary text-muted-foreground"
        >
          ‹
        </button>
        <p className="min-w-0 truncate text-sm">
          {dateLabel(date)}
          {isToday ? <span className="text-muted-foreground"> · сегодня</span> : null}
        </p>
        <div className="flex gap-1.5">
          {!isToday ? (
            <button type="button" onClick={() => setDate(isoDate(new Date()))} className="pressable h-9 rounded-lg bg-secondary px-2.5 text-tiny">
              Сегодня
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Следующий день"
            onClick={() => setDate(isoDate(addDays(parseISODate(date), 1)))}
            className="pressable size-9 rounded-lg bg-secondary text-muted-foreground"
          >
            ›
          </button>
        </div>
      </div>
      <MenuDayBody client={client} date={date} bookings={bookings} />
    </>
  );
}
