from pathlib import Path
p = Path("src/components/app/bookings-view.tsx")
t = p.read_text()
if "checkIn(booking.id)" in t:
    print("already")
else:
    if "const checkIn = useStudio" not in t:
        t = t.replace(
            "  const markNoShow = useStudio((s) => s.markNoShow);",
            "  const markNoShow = useStudio((s) => s.markNoShow);\n  const checkIn = useStudio((s) => s.checkIn);\n  const setActiveClient = useStudio((s) => s.setActiveClient);",
            1,
        )
    old = """              {role === "trainer" && !booking.checkedIn && !booking.noShow ? (
                <button
                  type="button"
                  onClick={() => markNoShow(booking.id)}
                  className="pressable mt-2 rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                >
                  Отметить неявку
                </button>
              ) : null}"""
    new = """              {role === "trainer" && !booking.checkedIn && !booking.noShow ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => checkIn(booking.id)}
                    className="pressable rounded-lg bg-ok/15 px-3 py-2 text-xs font-medium text-ok"
                  >
                    Явка
                  </button>
                  <button
                    type="button"
                    onClick={() => markNoShow(booking.id)}
                    className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                  >
                    Неявка
                  </button>
                </div>
              ) : null}
              {role === "trainer" && booking.checkedIn ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveClient(booking.clientId);
                    setTab("program");
                  }}
                  className="pressable mt-2 rounded-lg bg-secondary px-3 py-2 text-xs font-medium"
                >
                  К программе клиента
                </button>
              ) : null}"""
    if old not in t:
        raise SystemExit("block missing")
    p.write_text(t.replace(old, new, 1))
    print("ok")
