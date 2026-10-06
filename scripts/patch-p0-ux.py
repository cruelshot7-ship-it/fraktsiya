from pathlib import Path

# --- mini-app ---
mp = Path("src/components/app/mini-app.tsx")
mt = mp.read_text()
if "from \"@/components/app/sync-status\"" not in mt:
    mt = mt.replace(
        'import { HapticLayer } from "@/components/app/haptic-layer";',
        'import { HapticLayer } from "@/components/app/haptic-layer";\nimport { SyncStatusChip } from "@/components/app/sync-status";',
        1,
    )
old_t = '''                <h1 key={title} className="title-in font-display text-4xl leading-none tracking-wide">{title}</h1>
                <button type="button" onClick={() => setTab("signals")}'''
new_t = '''                <div>
                  <h1 key={title} className="title-in font-display text-4xl leading-none tracking-wide">{title}</h1>
                  <SyncStatusChip className="mt-1" />
                </div>
                <button type="button" onClick={() => setTab("signals")}'''
if "SyncStatusChip className=\"mt-1\"" not in mt and old_t in mt:
    mt = mt.replace(old_t, new_t, 1)
old_c = '''              <h1 key={title} className="title-in font-display mt-3 text-2xl leading-none tracking-wide">{title}</h1>
              <p className="mt-1.5 text-tiny text-muted-foreground">'''
new_c = '''              <h1 key={title} className="title-in font-display mt-3 text-2xl leading-none tracking-wide">{title}</h1>
              <SyncStatusChip className="mt-1" />
              <p className="mt-1.5 text-tiny text-muted-foreground">'''
if mt.count("SyncStatusChip className=\"mt-1\"") < 2 and old_c in mt:
    mt = mt.replace(old_c, new_c, 1)
mp.write_text(mt)
print("mini-app", mt.count("SyncStatusChip"))

# --- program-view ---
pp = Path("src/components/app/program-view.tsx")
pt = pp.read_text()
if "restOnly" in pt:
    print("program already")
else:
    old = '''          <ul className="mt-3 space-y-1.5">
            {shown.items.map((item, index) => {
              const mark = `${index}:${item}`;
              const on = checked.includes(mark);
              const bit = readPlanLine(item);
              return (
                <li key={mark}>
                  <button
                    type="button"
                    onClick={() => {
                      const marks = lineGroup(shown.items, index).map((i) => `${i}:${shown.items[i]}`);
                      const allOn = marks.every((m) => checked.includes(m));
                      for (const markId of marks) {
                        if (checked.includes(markId) === allOn) toggleCheck(markId);
                      }
                    }}
                    className={cn(
                      "pressable flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm",
                      on ? "bg-ok-dim text-foreground" : "bg-transparent",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border",
                        on ? "border-ok bg-ok text-ok-foreground" : "border-hairline",
                      )}
                    >
                      {on ? <Check className="size-3" /> : null}
                    </span>
                    <span className={on ? "line-through opacity-70" : ""}>{item}</span>
                  </button>
                  {on && bit.kind === "weight" ? (
                    <input
                      className={cn(inputClass, "mt-1 ml-10")}
                      inputMode="decimal"
                      placeholder="факт, кг — если другой"
                      value={facts[index] ?? ""}
                      onChange={(e) => {
                        const next = { ...facts, [index]: e.target.value };
                        setFacts(next);
                        if (factKey) localStorage.setItem(factKey, JSON.stringify(next));
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>'''
    new = '''          <ul className="mt-3 space-y-2">
            {(() => {
              const items = shown.items;
              const groups: number[][] = [];
              const seen = new Set<number>();
              for (let i = 0; i < items.length; i += 1) {
                if (seen.has(i)) continue;
                const g = lineGroup(items, i);
                g.forEach((j) => seen.add(j));
                groups.push(g);
              }
              return groups.map((group) => {
                const bits = group.map((i) => ({ i, item: items[i], bit: readPlanLine(items[i]) }));
                const restOnly = bits.every((b) => b.bit.kind === "rest");
                if (restOnly) {
                  return (
                    <li key={`rest-${group[0]}`} className="px-2 py-1.5 text-tiny text-muted-foreground">
                      {bits.map((b) => b.item).join(" · ")}
                    </li>
                  );
                }
                const title = bits.find((b) => b.bit.kind === "text") ?? bits[0];
                const meta = bits.filter((b) => b.i !== title.i);
                const marks = group.map((i) => `${i}:${items[i]}`);
                const on = marks.every((m) => checked.includes(m));
                const weightBit = bits.find((b) => b.bit.kind === "weight");
                return (
                  <li key={`g-${group[0]}`} className="rounded-lg border border-hairline/60 px-1 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        const allOn = marks.every((m) => checked.includes(m));
                        for (const markId of marks) {
                          if (checked.includes(markId) === allOn) toggleCheck(markId);
                        }
                      }}
                      className={cn(
                        "pressable flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left text-sm",
                        on ? "bg-ok-dim text-foreground" : "bg-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border",
                          on ? "border-ok bg-ok text-ok-foreground" : "border-hairline",
                        )}
                      >
                        {on ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block font-medium", on && "line-through opacity-70")}>{title.item}</span>
                        {meta.length ? (
                          <span className="mt-0.5 block text-tiny text-muted-foreground">
                            {meta.map((b) => b.item).join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {on && weightBit ? (
                      <input
                        className={cn(inputClass, "mt-1 mb-2 ml-10")}
                        inputMode="decimal"
                        placeholder="факт, кг — если другой"
                        value={facts[weightBit.i] ?? ""}
                        onChange={(e) => {
                          const next = { ...facts, [weightBit.i]: e.target.value };
                          setFacts(next);
                          if (factKey) localStorage.setItem(factKey, JSON.stringify(next));
                        }}
                      />
                    ) : null}
                  </li>
                );
              });
            })()}
          </ul>'''
    if old not in pt:
        raise SystemExit("program list missing")
    pt = pt.replace(old, new, 1)
    pp.write_text(pt)
    print("program ok")
print("done")
