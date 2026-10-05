from pathlib import Path
import re

p = Path("src/components/app/nutrition-view.tsx")
t = p.read_text()
if "Повторить вчера" in t and "grid-cols-2" in t:
    print("already")
    raise SystemExit(0)

if "addDays" not in t.split("from \"@/data/studio\"")[0]:
    t = t.replace(
        'import { dayKbju, isoDate, MEALS, sumFood, type Meal } from "@/data/studio";',
        'import { addDays, dayKbju, isoDate, MEALS, parseISODate, sumFood, type Meal } from "@/data/studio";',
        1,
    )

if "yesterdayFood" not in t:
    m = re.search(r"const todayFood = [^;]+;", t)
    if not m:
        raise SystemExit("todayFood missing")
    insert = m.group(0) + '''

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
  }'''
    t = t.replace(m.group(0), insert, 1)

t = t.replace(
    "        <div className=\"mt-3 grid grid-cols-1 gap-2\">",
    "        <div className=\"mt-3 grid grid-cols-2 gap-2\">",
    1,
)

old_card = '''                <button
                  key={meal.id}
                  type="button"
                  onClick={() => pick(meal.id)}
                  className={cn(
                    "pressable flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-3 text-left shadow-border",
                    fits ? "" : "opacity-70",
                  )}
                >
                  <div>
                    <span className="block text-sm font-medium">{meal.name}</span>
                    <span className="mt-0.5 block text-tiny text-muted-foreground">
                      {meal.calories} ккал · Б {meal.protein} · Ж {meal.fat} · У {meal.carbs}
                      {meal.kind ? ` · ${SLOT_LABEL[meal.kind]}` : ""}
                    </span>
                  </div>
                  <span className={cn("shrink-0 text-xs font-medium", fits ? "text-ok" : "text-muted-foreground")}>
                    {fits ? "В цель" : "Больше остатка"} · +
                  </span>
                </button>'''
new_card = '''                <button
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
                </button>'''
if old_card not in t:
    raise SystemExit("card missing")
t = t.replace(old_card, new_card, 1)

if "Повторить вчера" not in t:
    t = t.replace(
        '''      {todayFood.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Дневник</SectionLabel>''',
        '''      {yesterdayFood.length > 0 ? (
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
          <SectionLabel>Дневник</SectionLabel>''',
        1,
    )

p.write_text(t)
print("D ok")
