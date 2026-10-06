from pathlib import Path

parts = [Path(f"scripts/preset-part-{i}.txt").read_text() for i in range(4)]
CHUNK = "".join(parts)
studio = Path("src/data/studio.ts")
st = studio.read_text()
start = st.index("export type BuildGoal")
end = st.index("export type WeightPoint")
studio.write_text(st[:start] + CHUNK + st[end:])
print("studio ok")

# client-editors: imports + preset state + UI
ce = Path("src/components/app/client-editors.tsx")
t = ce.read_text()
if "PROGRAM_PRESETS" not in t:
    t = t.replace(
        "  buildProgram,",
        "  buildProgram,\n  PROGRAM_PRESETS,\n  type ProgramPreset,",
        1,
    )
if "setPreset" not in t:
    t = t.replace(
        '  const [goal, setGoal] = useState<BuildGoal>("shape");',
        '  const [goal, setGoal] = useState<BuildGoal>("shape");\n  const [preset, setPreset] = useState<ProgramPreset>("beginner");',
        1,
    )
old_ui = '''      <SectionLabel>Собрать по клиенту</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["shape", "Форма"],
            ["strength", "Сила"],
            ["cut", "Легче"],
          ] as [BuildGoal, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGoal(id)}
            className={cn("pressable h-11 rounded-lg text-sm", goal === id ? "bg-primary text-primary-foreground" : "bg-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pressable h-11 rounded-xl bg-secondary text-sm"
        onClick={() => {
          const built = buildProgram(draft, goal);
          setDraft({ ...draft, programTitle: built.programTitle, sessions: built.sessions });
        }}
      >
        Собрать черновик
      </button>
      <p className="text-tiny text-muted-foreground">
        {draft.weight > 0
          ? `Вес ${draft.weight} кг, визитов ${draft.trainDays.length || 3}. Веса стартовые, поправь и сохрани.`
          : "Веса клиента нет, поэтому килограммы не ставлю. Дни и схема будут, вес допишешь сам."}
      </p>'''
new_ui = '''      <SectionLabel>Сплит · шаблон</SectionLabel>
      <div className="grid grid-cols-1 gap-1.5">
        {PROGRAM_PRESETS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setPreset(row.id)}
            className={cn(
              "pressable rounded-xl px-3 py-2.5 text-left",
              preset === row.id ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            <span className="block text-sm font-medium">{row.label}</span>
            <span className={cn("mt-0.5 block text-2xs", preset === row.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
              {row.hint}
            </span>
          </button>
        ))}
      </div>
      <SectionLabel>Цель нагрузки</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["shape", "Форма"],
            ["strength", "Сила"],
            ["cut", "Легче"],
          ] as [BuildGoal, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGoal(id)}
            className={cn("pressable h-11 rounded-lg text-sm", goal === id ? "bg-primary text-primary-foreground" : "bg-secondary")}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="pressable h-11 rounded-xl bg-secondary text-sm"
        onClick={() => {
          const built = buildProgram(draft, goal, preset);
          setDraft({ ...draft, programTitle: built.programTitle, sessions: built.sessions });
        }}
      >
        Собрать черновик
      </button>
      <p className="text-tiny text-muted-foreground">
        {draft.weight > 0
          ? `Вес ${draft.weight} кг. Веса стартовые — поправь под технику и сохрани.`
          : "Веса клиента нет — килограммы не ставлю. Схему сохрани, вес допиши сам."}
      </p>'''
if old_ui in t:
    t = t.replace(old_ui, new_ui, 1)
    print("editors ok")
elif "PROGRAM_PRESETS.map" in t:
    print("editors already")
else:
    raise SystemExit("editors UI block missing")
ce.write_text(t)
print("done")
