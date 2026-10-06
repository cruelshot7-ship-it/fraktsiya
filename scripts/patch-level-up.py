from pathlib import Path

# --- program-view: complete → toast + food tab ---
p = Path("src/components/app/program-view.tsx")
t = p.read_text()
if "setTab(" not in t or "const setTab" not in t:
    if "const showToast = useStudio((s) => s.showToast);" in t and "const setTab = useStudio" not in t:
        t = t.replace(
            "  const showToast = useStudio((s) => s.showToast);",
            "  const showToast = useStudio((s) => s.showToast);\n  const setTab = useStudio((s) => s.setTab);",
            1,
        )
old = """                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume);
                  try {
                    if (startKey) localStorage.removeItem(startKey);
                    if (factKey) localStorage.removeItem(factKey);
                  } catch {
                    /* ignore */
                  }
                  setStartedAt(null);
                  setFacts({});
"""
new = """                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume);
                  try {
                    if (startKey) localStorage.removeItem(startKey);
                    if (factKey) localStorage.removeItem(factKey);
                  } catch {
                    /* ignore */
                  }
                  setStartedAt(null);
                  setFacts({});
                  showToast("Тренировка записана · можно отметить еду");
                  setTab("food");
"""
if "можно отметить еду" in t:
    print("program already")
elif old not in t:
    raise SystemExit("completeWorkout block missing")
else:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("program ok")

# --- today-view trainer toasts ---
p = Path("src/components/app/today-view.tsx")
t = p.read_text()
if "const showToast = useStudio" not in t:
    t = t.replace(
        "  const rejectJoin = useStudio((s) => s.rejectJoin);",
        "  const rejectJoin = useStudio((s) => s.rejectJoin);\n  const showToast = useStudio((s) => s.showToast);",
        1,
    )

old1 = """                    <button
                      type="button"
                      className="pressable rounded-lg bg-ok/15 px-3 py-2 text-xs font-medium text-ok"
                      onClick={() => checkIn(b.id)}
                    >
                      Явка
                    </button>
                    <button
                      type="button"
                      className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                      onClick={() => markNoShow(b.id)}
                    >
                      Неявка
                    </button>
"""
new1 = """                    <button
                      type="button"
                      className="pressable rounded-lg bg-ok/15 px-3 py-2 text-xs font-medium text-ok"
                      onClick={() => {
                        checkIn(b.id);
                        showToast(name ? `Явка · ${name}` : "Явка отмечена");
                      }}
                    >
                      Явка
                    </button>
                    <button
                      type="button"
                      className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                      onClick={() => {
                        markNoShow(b.id);
                        showToast(name ? `Неявка · ${name}` : "Неявка отмечена");
                      }}
                    >
                      Неявка
                    </button>
"""
if "Явка · ${name}" in t or "Явка · ${" in t:
    print("today toasts already")
elif old1 not in t:
    raise SystemExit("today checkin buttons missing")
else:
    t = t.replace(old1, new1, 1)
    p.write_text(t)
    print("today ok")
