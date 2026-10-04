from pathlib import Path

# --- bits.tsx ---
p = Path("src/components/app/bits.tsx")
t = p.read_text()
if "export function KbjuMeters" in t:
    print("bits already")
else:
    t = t.replace(
        'import type { ReactNode } from "react";',
        'import { useEffect, useState, type ReactNode } from "react";',
        1,
    )
    old_rail = '''export function ProgressRail({
  value,
  max,
  tone = "ok",
}: {
  value: number;
  max: number;
  tone?: "ok" | "alert";
}) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="h-1 overflow-hidden rounded-full bg-secondary">
      <span
        className={cn("block h-full rounded-full transition-[width] duration-500", tone === "alert" ? "bg-primary" : "bg-ok")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}'''
    new_rail = '''export function ProgressRail({
  value,
  max,
  tone = "ok",
}: {
  value: number;
  max: number;
  tone?: "ok" | "alert";
}) {
  const pct = max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary/80">
      <span
        className={cn(
          "block h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "alert"
            ? "bg-primary shadow-[0_0_12px_rgb(221_51_42_/0.35)]"
            : "bg-ok shadow-[0_0_12px_rgb(69_212_228_/0.35)]",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Animated ring: fills as current approaches target (or full when no target). */
export function KbjuMacroRing({
  label,
  current,
  target,
}: {
  label: string;
  current: number;
  target: number;
}) {
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
  const max = safeTarget > 0 ? safeTarget : Math.max(safeCurrent, 1);
  const ratio = Math.min(1, Math.max(0, safeCurrent / max));
  const over = safeTarget > 0 && safeCurrent > safeTarget * 1.05;

  const [shown, setShown] = useState(0);
  useEffect(() => {
    let from = 0;
    setShown((prev) => {
      from = prev;
      return prev;
    });
    const to = Math.round(safeCurrent);
    const start = performance.now();
    const dur = 520;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (to - from) * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [safeCurrent]);

  const r = 18;
  const c = 2 * Math.PI * r;
  const stroke = over ? "var(--color-primary)" : ratio >= 0.92 ? "var(--color-ok)" : "var(--color-primary)";

  return (
    <button
      type="button"
      className="pressable flex flex-col items-center gap-1 rounded-xl px-1 py-1"
      aria-label={`${label}: ${Math.round(safeCurrent)}${safeTarget > 0 ? ` из ${Math.round(safeTarget)}` : ""}`}
    >
      <div className="relative size-[3.25rem]">
        <svg viewBox="0 0 44 44" className="size-full -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3.5" />
          <circle
            cx="22"
            cy="22"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3.5"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - ratio)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.32, 0.72, 0, 1), stroke 300ms ease" }}
          />
        </svg>
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="font-display text-sm tabular-nums leading-none text-foreground">{shown}</span>
        </span>
      </div>
      {safeTarget > 0 ? (
        <span className="text-3xs tabular-nums text-muted-foreground">/{Math.round(safeTarget)}</span>
      ) : (
        <span className="text-3xs text-muted-foreground">факт</span>
      )}
      <span className="text-2xs tracking-wide text-muted-foreground uppercase">{label}</span>
    </button>
  );
}

/** Four macro rings + rail — shared by Program and Nutrition. */
export function KbjuMeters({
  eaten,
  target,
  title,
}: {
  eaten: { calories: number; protein: number; fat: number; carbs: number };
  target: { calories: number; protein: number; fat: number; carbs: number };
  title?: string;
}) {
  const hasGoal = target.calories > 0;
  const low = hasGoal && eaten.calories > 0 && eaten.calories < target.calories * 0.72;
  const over = hasGoal && eaten.calories > target.calories * 1.08;
  return (
    <div>
      {title ? <SectionLabel>{title}</SectionLabel> : null}
      <div className={title ? "mt-3" : undefined}>
        <ProgressRail
          value={eaten.calories}
          max={hasGoal ? target.calories : Math.max(eaten.calories, 1)}
          tone={low || over ? "alert" : "ok"}
        />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-1">
        <KbjuMacroRing label="ккал" current={eaten.calories} target={target.calories} />
        <KbjuMacroRing label="Б" current={eaten.protein} target={target.protein} />
        <KbjuMacroRing label="Ж" current={eaten.fat} target={target.fat} />
        <KbjuMacroRing label="У" current={eaten.carbs} target={target.carbs} />
      </div>
    </div>
  );
}'''
    if old_rail not in t:
        raise SystemExit("ProgressRail missing")
    p.write_text(t.replace(old_rail, new_rail, 1))
    print("bits ok")

# --- program-view ---
p = Path("src/components/app/program-view.tsx")
t = p.read_text()
if "KbjuMeters" in t and "function Macro(" not in t:
    print("program already")
else:
    t = t.replace(
        'import { Field, inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";',
        'import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";',
        1,
    )
    # also if already mixed
    t = t.replace(
        'import { Field, inputClass, KbjuMeters, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";',
        'import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";',
        1,
    )
    import re
    # Replace KBJU surface block flexibly
    m = re.search(
        r'<Surface>\s*<SectionLabel>КБЖУ[^<]*</SectionLabel>[\s\S]*?</Surface>',
        t,
        count=1,
    )
    # Python re doesn't have count in search - use search once
    m = re.search(r'<Surface>\s*<SectionLabel>КБЖУ[\s\S]*?</Surface>', t)
    if not m:
        # maybe already KbjuMeters
        if "KbjuMeters" in t:
            print("program block already meters")
        else:
            raise SystemExit("program KBJU surface missing")
    else:
        new_block = '''<Surface>
        <KbjuMeters
          title={`КБЖУ · ${t.calories > 0 ? "ваша цель" : "сегодня"}`}
          eaten={eaten}
          target={t}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          {t.calories > 0
            ? `Сегодня: ${eaten.calories} из ${t.calories} ккал. Цель от тренера.`
            : eaten.calories > 0
              ? `Сегодня: ${eaten.calories} ккал по вашим записям. Цель тренер ещё не задал.`
              : "Добавьте еду во вкладке «Еда» — цифры появятся здесь."}
        </p>
      </Surface>'''
        t = t[: m.start()] + new_block + t[m.end() :]
    # remove Macro function
    start = t.find("function Macro(")
    if start >= 0:
        i = start
        depth = 0
        began = False
        end = None
        while i < len(t):
            if t[i] == "{":
                depth += 1
                began = True
            elif t[i] == "}":
                depth -= 1
                if began and depth == 0:
                    end = i + 1
                    break
            i += 1
        if end:
            while end < len(t) and t[end] in "\n":
                end += 1
            t = t[:start] + t[end:]
    p.write_text(t)
    print("program ok")

# --- nutrition-view ---
p = Path("src/components/app/nutrition-view.tsx")
t = p.read_text()
if "KbjuMeters" in t:
    print("nutrition already")
else:
    t = t.replace(
        'import { Field, inputClass, ProgressRail, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";',
        'import { Field, inputClass, KbjuMeters, SectionLabel, Surface, EmptyHint } from "@/components/app/bits";',
        1,
    )
    import re
    m = re.search(
        r'<Surface glow=\{low \? "alert" : "ok"\}>[\s\S]*?Осталось[\s\S]*?</Surface>|<Surface glow=\{low \? "alert" : "ok"\}>[\s\S]*?Цель КБЖУ[\s\S]*?</Surface>',
        t,
    )
    if not m:
        # try simpler: first Surface with SectionLabel Сегодня
        m = re.search(r'<Surface glow=\{low \? "alert" : "ok"\}>[\s\S]*?</Surface>', t)
    if not m:
        raise SystemExit("nutrition surface missing")
    new_s = '''<Surface glow={low ? "alert" : "ok"}>
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
      </Surface>'''
    t = t[: m.start()] + new_s + t[m.end() :]
    p.write_text(t)
    print("nutrition ok")
