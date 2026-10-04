from pathlib import Path

def patch_program():
    p = Path("src/components/app/program-view.tsx")
    t = p.read_text()
    if "value > 0 ? value : current" in t:
        print("program already")
        return
    t2 = t.replace(
        "  const ratio = Math.min(1, current / value);",
        "  const ratio = value > 0 ? Math.min(1, current / value) : current > 0 ? 1 : 0;\n  const shown = value > 0 ? value : current;",
        1,
    )
    if t2 == t:
        raise SystemExit("ratio line missing")
    t = t2
    t2 = t.replace(
        '<span className="font-display text-sm tabular-nums">{value}</span>',
        '<span className="font-display text-sm tabular-nums">{shown}</span>',
        1,
    )
    if t2 == t:
        raise SystemExit("value span missing")
    t = t2
    t2 = t.replace(
        "<ProgressRail value={eaten.calories} max={t.calories} />",
        "<ProgressRail value={eaten.calories} max={t.calories > 0 ? t.calories : Math.max(eaten.calories, 1)} />",
        1,
    )
    if t2 == t:
        raise SystemExit("ProgressRail missing")
    t = t2
    t2 = t.replace(
        "Сегодня: {eaten.calories} ккал. Тренер выставил индивидуально.",
        "{t.calories > 0\n            ? `Сегодня: ${eaten.calories} из ${t.calories} ккал. Цель от тренера.`\n            : eaten.calories > 0\n              ? `Сегодня: ${eaten.calories} ккал по вашим записям. Цель тренер ещё не задал.`\n              : \"Добавьте еду во вкладке «Еда» — цифры появятся здесь.\"}",
        1,
    )
    if t2 == t:
        raise SystemExit("footnote missing")
    p.write_text(t2)
    print("program ok")

def patch_nutrition():
    p = Path("src/components/app/nutrition-view.tsx")
    t = p.read_text()
    if "ккал сегодня" in t:
        print("nutrition already")
        return
    t2 = t.replace(
        '<span className="ml-1 text-base text-muted-foreground">/ {goal.kbju.calories} ккал</span>',
        '<span className="ml-1 text-base text-muted-foreground">{goal.kbju.calories > 0 ? `/ ${goal.kbju.calories} ккал` : "ккал сегодня"}</span>',
        1,
    )
    t2 = t2.replace(
        "<ProgressRail value={totals.calories} max={goal.kbju.calories} tone={low ? \"alert\" : \"ok\"} />",
        "<ProgressRail value={totals.calories} max={goal.kbju.calories > 0 ? goal.kbju.calories : Math.max(totals.calories, 1)} tone={low ? \"alert\" : \"ok\"} />",
        1,
    )
    t2 = t2.replace(
        "<span>Б {totals.protein}/{goal.kbju.protein}</span>\n          <span>Ж {totals.fat}/{goal.kbju.fat}</span>\n          <span>У {totals.carbs}/{goal.kbju.carbs}</span>",
        "<span>Б {totals.protein}{goal.kbju.protein > 0 ? `/${goal.kbju.protein}` : \"\"}</span>\n          <span>Ж {totals.fat}{goal.kbju.fat > 0 ? `/${goal.kbju.fat}` : \"\"}</span>\n          <span>У {totals.carbs}{goal.kbju.carbs > 0 ? `/${goal.kbju.carbs}` : \"\"}</span>",
        1,
    )
    if t2 == t:
        raise SystemExit("nutrition no change")
    p.write_text(t2)
    print("nutrition ok")

patch_program()
patch_nutrition()
