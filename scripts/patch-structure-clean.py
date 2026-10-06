from pathlib import Path
p = Path("src/components/app/client-editors.tsx")
t = p.read_text()
if "defaultDays" in t:
    print("already")
    raise SystemExit(0)
old = '''        onClick={() => {
          const built = buildProgram(draft, goal, preset);
          setDraft({ ...draft, programTitle: built.programTitle, sessions: built.sessions });
        }}'''
new = '''        onClick={() => {
          const built = buildProgram(draft, goal, preset);
          const n = built.sessions.length;
          const defaultDays: Record<number, number[]> = {
            2: [0, 3],
            3: [0, 2, 4],
            4: [0, 1, 3, 4],
          };
          const trainDays =
            draft.trainDays.length > 0 ? draft.trainDays : (defaultDays[n] ?? [0, 2, 4]);
          setDraft({
            ...draft,
            programTitle: built.programTitle,
            sessions: built.sessions,
            trainDays,
            programStart: isoDate(new Date()),
            programWeeks: draft.programWeeks || 8,
          });
        }}'''
if old not in t:
    raise SystemExit("onclick missing")
t = t.replace(old, new, 1)
old_hint = '''      <p className="text-tiny text-muted-foreground">
        {draft.weight > 0
          ? `Вес ${draft.weight} кг. Веса стартовые — поправь под технику и сохрани.`
          : "Веса клиента нет — килограммы не ставлю. Схему сохрани, вес допиши сам."}
      </p>'''
new_hint = '''      <p className="text-tiny text-muted-foreground">
        {draft.weight > 0
          ? `Вес ${draft.weight} кг. Веса стартовые — поправь под технику.`
          : "Веса нет — кг не ставлю."}{" "}
        Сплит из {draft.sessions.length || "—"} блоков · дни:{" "}
        {draft.trainDays.length
          ? draft.trainDays.map((d) => DOW[d]).join(", ")
          : "выберутся при сборке"}
        . Старт цикла — сегодня (сброс при «Собрать»).
      </p>'''
if old_hint not in t:
    raise SystemExit("hint missing")
t = t.replace(old_hint, new_hint, 1)
p.write_text(t)
print("ok")
