from pathlib import Path

p = Path("src/components/app/program-view.tsx")
t = p.read_text()
if "const goal = value > 0 ? value : current" in t:
    print("program already")
else:
    old_macro = """function Macro({
  label,
  value,
  current,
}: {
  label: string;
  value: number;
  current: number;
}) {
  const ratio = Math.min(1, current / value);
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className=\"flex flex-col items-center gap-1\">
      <svg viewBox=\"0 0 40 40\" className=\"size-12 -rotate-90\">
        <circle cx=\"20\" cy=\"20\" r={r} fill=\"none\" stroke=\"var(--color-border)\" strokeWidth=\"3\" />
        <circle
          cx=\"20\"
          cy=\"20\"
          r={r}
          fill=\"none\"
          stroke=\"var(--color-primary)\"
          strokeWidth=\"3\"
          strokeDasharray={`${c * ratio} ${c}`}
          strokeLinecap=\"round\"
        />
      </svg>
      <span className=\"font-display text-sm tabular-nums\">{value}</span>
      <span className=\"text-2xs tracking-wide text-muted-foreground uppercase\">{label}</span>
    </div>
  );
}"""
    new_macro = """function Macro({
  label,
  value,
  current,
}: {
  label: string;
  value: number;
  current: number;
}) {
  // Target from trainer (value) or filled from logged food (current) when target is 0.
  const goal = value > 0 ? value : current;
  const shown = value > 0 ? value : current;
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <div className=\"flex flex-col items-center gap-1\">
      <svg viewBox=\"0 0 40 40\" className=\"size-12 -rotate-90\">
        <circle cx=\"20\" cy=\"20\" r={r} fill=\"none\" stroke=\"var(--color-border)\" strokeWidth=\"3\" />
        <circle
          cx=\"20\"
          cy=\"20\"
          r={r}
          fill=\"none\"
          stroke=\"var(--color-primary)\"
          strokeWidth=\"3\"
          strokeDasharray={`${c * ratio} ${c}`}
          strokeLinecap=\"round\"
        />
      </svg>
      <span className=\"font-display text-sm tabular-nums\">{shown}</span>
      <span className=\"text-2xs tracking-wide text-muted-foreground uppercase\">{label}</span>
    </div>
  );
}"""
    if old_macro not in t:
        raise SystemExit("Macro missing")
    t = t.replace(old_macro, new_macro, 1)
    old_block = """      <Surface>
        <SectionLabel>КБЖУ · ваша цель</SectionLabel>
        <div className=\"mt-3\">
          <ProgressRail value={eaten.calories} max={t.calories} />
        </div>
        <div className=\"mt-4 grid grid-cols-4 gap-2\">
          <Macro label=\"ккал\" value={t.calories} current={eaten.calories} />
          <Macro label=\"Б\" value={t.protein} current={eaten.protein} />
          <Macro label=\"Ж\" value={t.fat} current={eaten.fat} />
          <Macro label=\"У\" value={t.carbs} current={eaten.carbs} />
        </div>
        <p className=\"mt-3 text-xs text-muted-foreground\">
          Сегодня: {eaten.calories} ккал. Тренер выставил индивидуально.
        </p>
      </Surface>"""
    new_block = """      <Surface>
        <SectionLabel>КБЖУ · {t.calories > 0 ? \"ваша цель\" : \"сегодня\"}</SectionLabel>
        <div className=\"mt-3\">
          <ProgressRail value={eaten.calories} max={t.calories > 0 ? t.calories : Math.max(eaten.calories, 1)} />
        </div>
        <div className=\"mt-4 grid grid-cols-4 gap-2\">
          <Macro label=\"ккал\" value={t.calories} current={eaten.calories} />
          <Macro label=\"Б\" value={t.protein} current={eaten.protein} />
          <Macro label=\"Ж\" value={t.fat} current={eaten.fat} />
          <Macro label=\"У\" value={t.carbs} current={eaten.carbs} />
        </div>
        <p className=\"mt-3 text-xs text-muted-foreground\">
          {t.calories > 0
            ? `Сегодня: ${eaten.calories} из ${t.calories} ккал. Цель от тренера.`
            : eaten.calories > 0
              ? `Сегодня: ${eaten.calories} ккал по вашим записям. Цель тренер ещё не задал.`
              : \"Добавьте еду во вкладке «Еда» — цифры появятся здесь.\"}
        </p>
      </Surface>"""
    if old_block not in t:
        raise SystemExit("block missing")
    t = t.replace(old_block, new_block, 1)
    p.write_text(t)
    print("program patched")

p = Path("src/components/app/nutrition-view.tsx")
t = p.read_text()
if "ккал сегодня" in t:
    print("nutrition already")
else:
    old = """        <p className=\"font-display mt-2 text-3xl tabular-nums\">
          {totals.calories}
          <span className=\"ml-1 text-base text-muted-foreground\">/ {goal.kbju.calories} ккал</span>
        </p>
        <div className=\"mt-3\">
          <ProgressRail value={totals.calories} max={goal.kbju.calories} tone={low ? \"alert\" : \"ok\"} />
        </div>
        <div className=\"mt-3 grid grid-cols-3 gap-2 text-tiny text-muted-foreground\">
          <span>Б {totals.protein}/{goal.kbju.protein}</span>
          <span>Ж {totals.fat}/{goal.kbju.fat}</span>
          <span>У {totals.carbs}/{goal.kbju.carbs}</span>
        </div>"""
    new = """        <p className=\"font-display mt-2 text-3xl tabular-nums\">
          {totals.calories}
          <span className=\"ml-1 text-base text-muted-foreground\">
            {goal.kbju.calories > 0 ? `/ ${goal.kbju.calories} ккал` : \"ккал сегодня\"}
          </span>
        </p>
        <div className=\"mt-3\">
          <ProgressRail
            value={totals.calories}
            max={goal.kbju.calories > 0 ? goal.kbju.calories : Math.max(totals.calories, 1)}
            tone={low ? \"alert\" : \"ok\"}
          />
        </div>
        <div className=\"mt-3 grid grid-cols-3 gap-2 text-tiny text-muted-foreground\">
          <span>Б {totals.protein}{goal.kbju.protein > 0 ? `/${goal.kbju.protein}` : \"\"}</span>
          <span>Ж {totals.fat}{goal.kbju.fat > 0 ? `/${goal.kbju.fat}` : \"\"}</span>
          <span>У {totals.carbs}{goal.kbju.carbs > 0 ? `/${goal.kbju.carbs}` : \"\"}</span>
        </div>"""
    if old not in t:
        raise SystemExit("nutrition missing")
    p.write_text(t.replace(old, new, 1))
    print("nutrition patched")
