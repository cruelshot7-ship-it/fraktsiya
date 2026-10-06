from pathlib import Path
p = Path("src/components/app/bookings-view.tsx")
t = p.read_text()
if "Явка сегодня" in t or "checkIn(booking.id)" in t and "booking.date === today" in t:
    # may need today const
    pass

# ensure isoDate import
if "isoDate" not in t.split("from \"@/data/studio\"")[0][-800:]:
    t = t.replace(
        "  isSlotPast,\n",
        "  isSlotPast,\n  isoDate,\n",
        1,
    )

if "const today = isoDate" not in t:
    t = t.replace(
        "  const hoursToNext = next ? hoursUntilSlot(next.date, next.time) : null;",
        "  const hoursToNext = next ? hoursUntilSlot(next.date, next.time) : null;\n  const today = isoDate(new Date());",
        1,
    )

old = '''              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPendingId(booking.id)}
                  className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                >
                  {role === "trainer" ? "Отменить · вернуть занятие" : "Отменить запись"}
                </button>
                {role === "client" ? (
                  <button
                    type="button"
                    onClick={() =>
                      downloadIcs(
                        `ruksha-${booking.date}.ics`,
                        bookingIcs(booking),
                      )
                    }
                    className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                  >
                    В календарь
                  </button>
                ) : null}
              </div>'''

new = '''              <div className="mt-3 flex flex-wrap gap-2">
                {role === "trainer" && booking.date === today && !booking.checkedIn && !booking.noShow ? (
                  <button
                    type="button"
                    onClick={() => checkIn(booking.id)}
                    className="pressable rounded-lg bg-ok/15 px-3 py-2 text-xs font-medium text-ok"
                  >
                    Явка
                  </button>
                ) : null}
                {role === "trainer" && booking.checkedIn ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveClient(booking.clientId);
                      setTab("program");
                    }}
                    className="pressable rounded-lg bg-secondary px-3 py-2 text-xs font-medium"
                  >
                    К программе
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setPendingId(booking.id)}
                  className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                >
                  {role === "trainer" ? "Отменить · вернуть занятие" : "Отменить запись"}
                </button>
                {role === "client" ? (
                  <button
                    type="button"
                    onClick={() =>
                      downloadIcs(
                        `ruksha-${booking.date}.ics`,
                        bookingIcs(booking),
                      )
                    }
                    className="pressable rounded-lg bg-secondary px-3 py-2 text-xs text-muted-foreground"
                  >
                    В календарь
                  </button>
                ) : null}
              </div>'''

if "booking.date === today && !booking.checkedIn" in t:
    print("upcoming checkin already")
elif old not in t:
    raise SystemExit("upcoming actions block missing")
else:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("ok")
