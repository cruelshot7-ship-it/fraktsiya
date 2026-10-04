from pathlib import Path
p = Path("src/components/app/client-slots.tsx")
t = p.read_text()
if "ds-slot" in t and "ds-day" in t:
    print("already")
    raise SystemExit(0)
old = '''                className={cn(
                  "rounded-xl bg-card p-4 shadow-border",
                  mine && "ring-1 ring-ok/40",
                  past && "opacity-60",
                )}'''
new = '''                className={cn(
                  "ds-slot bg-card p-4",
                  mine && "is-mine",
                  past && "is-past",
                )}'''
if old not in t:
    raise SystemExit("slot card missing")
t = t.replace(old, new, 1)
t = t.replace(
    'className="pressable h-10 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground"',
    'className="pressable ds-cta"',
    1,
)
t = t.replace(
    'className="pressable h-10 rounded-xl bg-secondary px-3 text-xs"',
    'className="pressable ds-cta-ghost"',
    1,
)
old_day = '''              className={cn(
                "pressable flex flex-col items-center rounded-lg py-2 text-2xs",
                active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
              )}
            >
              <span>{d.dow}</span>
              <span className="mt-0.5 font-medium tabular-nums">{d.label}</span>
              {d.free > 0 ? <span className="mt-0.5 size-1 rounded-full bg-ok" /> : <span className="mt-0.5 size-1" />}'''
new_day = '''              className={cn("pressable ds-day", active && "is-active")}
            >
              <span>{d.dow}</span>
              <span className="mt-0.5 font-medium tabular-nums">{d.label}</span>
              {d.free > 0 ? <span className="ds-dot" /> : <span className="mt-0.5 size-1" />}'''
if old_day not in t:
    raise SystemExit("day block missing")
t = t.replace(old_day, new_day, 1)
p.write_text(t)
print("ok")
