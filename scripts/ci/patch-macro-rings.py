from pathlib import Path

p = Path("src/components/app/program-view.tsx")
t = p.read_text()

new_macro = '''function Macro({
  label,
  value,
  current,
}: {
  label: string;
  value: number;
  current: number;
}) {
  // value = trainer target; current = logged today.
  // Ring fills current/target; if no target, ring is full when current > 0.
  const safeCurrent = Number.isFinite(current) ? Math.max(0, current) : 0;
  const safeTarget = Number.isFinite(value) ? Math.max(0, value) : 0;
  const max = safeTarget > 0 ? safeTarget : Math.max(safeCurrent, 1);
  const ratio = Math.min(1, Math.max(0, safeCurrent / max));
  const r = 16;
  const c = 2 * Math.PI * r;
  const display = Math.round(safeCurrent);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 40 40" className="size-12 -rotate-90" aria-hidden>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="3"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <span className="font-display text-sm tabular-nums leading-none">{display}</span>
      {safeTarget > 0 ? (
        <span className="text-3xs tabular-nums text-muted-foreground">/{Math.round(safeTarget)}</span>
      ) : null}
      <span className="text-2xs tracking-wide text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
'''

start = t.find("function Macro(")
if start < 0:
    raise SystemExit("Macro missing")

# Prefer removing corrupted duplicate if present
junk = t.find("const shown = value > 0 ? value : current", start)
if junk >= 0:
    end = t.find("  );\n}", junk) + len("  );\n}")
    t = t[:start] + new_macro + t[end:]
    print("removed junk duplicate")
elif "strokeDashoffset={c * (1 - ratio)}" in t and t.count("function Macro(") == 1 and "const shown = value > 0" not in t:
    print("already clean")
    raise SystemExit(0)
else:
    # replace single Macro by brace-depth from start
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
    if end is None:
        raise SystemExit("Macro end missing")
    t = t[:start] + new_macro + t[end:]
    print("replaced Macro")

if "const shown = value > 0" in t:
    raise SystemExit("junk still present")
if t.count("function Macro(") != 1:
    raise SystemExit("Macro count != 1")
if "strokeDashoffset={c * (1 - ratio)}" not in t:
    raise SystemExit("strokeDashoffset missing")

p.write_text(t)
print("ok")
