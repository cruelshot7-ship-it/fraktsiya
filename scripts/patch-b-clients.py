from pathlib import Path

studio = Path("src/data/studio.ts")
st = studio.read_text()

old_sn = '''export function shortName(client: Pick<Client, "firstName" | "lastName">) {
  return `${client.firstName} ${client.lastName.charAt(0)}.`;
}'''
new_sn = '''export function shortName(client: Pick<Client, "firstName" | "lastName">) {
  const last = (client.lastName ?? "").trim();
  if (!last) return client.firstName;
  return `${client.firstName} ${last.charAt(0)}.`;
}'''
if old_sn in st:
    st = st.replace(old_sn, new_sn, 1)
    print("shortName ok")
elif "if (!last) return client.firstName" in st:
    print("shortName already")
else:
    raise SystemExit("shortName missing")

if "neverReported" not in st:
    st = st.replace(
        "  const noReport = daysSinceReport >= 3;\n  const lateOften = (client.lateCancels ?? 0) >= 2;",
        "  const hasReport = Boolean(client.lastReportAt);\n  const noReport = hasReport && daysSinceReport >= 3;\n  const neverReported = !hasReport;\n  const lateOften = (client.lateCancels ?? 0) >= 2;",
        1,
    )
    st = st.replace(
        "  const attention = noReport || lowCal || lateOften || lowPack || frozen || (expiring !== null && expiring <= 7);",
        "  const attention =\n    noReport || neverReported || lowCal || lateOften || lowPack || frozen || (expiring !== null && expiring <= 7);",
        1,
    )
    st = st.replace(
        '''  } else if (noReport) {
    badge = `нет отчёта ${daysSinceReport} ${daysRu(daysSinceReport)}`;
    tone = "alert";
  } else if (lateOften) {''',
        '''  } else if (noReport && daysSinceReport <= 60) {
    badge = `нет отчёта ${daysSinceReport} ${daysRu(daysSinceReport)}`;
    tone = "alert";
  } else if (noReport || neverReported) {
    badge = "нет отчёта";
    tone = "alert";
  } else if (lateOften) {''',
        1,
    )
    print("flag ok")
else:
    print("flag already")

studio.write_text(st)

cv = Path("src/components/app/clients-view.tsx")
ct = cv.read_text()
if "future.slice(0, 4)" in ct:
    print("multi already")
else:
    old = '''                <button
                  type="button"
                  disabled={!next}
                  className={cn(
                    "pressable flex h-11 items-center justify-center rounded-lg text-sm font-medium",
                    next ? "bg-secondary text-foreground" : "bg-secondary/50 text-muted-foreground",
                  )}
                  onClick={() => {
                    if (!next) return;
                    cancelBooking(next.id, "trainer");
                    showToast(
                      `Отменено · ${next.date === today ? "сегодня" : formatDayMonth(next.date)} ${next.time} · ${shortName(client)}`,
                    );
                    setActionClientId(null);
                    setConfirmRemove(false);
                  }}
                >
                  {next
                    ? `Отменить слот · ${next.date === today ? "сегодня" : formatDayMonth(next.date)} ${next.time}`
                    : "Нет ближайшего слота"}
                </button>'''
    new = '''                {(() => {
                  const future = bookings
                    .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
                    .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`));
                  if (!future.length) {
                    return (
                      <button
                        type="button"
                        disabled
                        className="pressable flex h-11 items-center justify-center rounded-lg bg-secondary/50 text-sm font-medium text-muted-foreground"
                      >
                        Нет ближайшего слота
                      </button>
                    );
                  }
                  return future.slice(0, 4).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="pressable flex h-11 items-center justify-center rounded-lg bg-secondary text-sm font-medium text-foreground"
                      onClick={() => {
                        cancelBooking(row.id, "trainer");
                        showToast(
                          `Отменено · ${row.date === today ? "сегодня" : formatDayMonth(row.date)} ${row.time} · ${shortName(client)}`,
                        );
                        setActionClientId(null);
                        setConfirmRemove(false);
                      }}
                    >
                      Отменить слот · {row.date === today ? "сегодня" : formatDayMonth(row.date)} {row.time}
                    </button>
                  ));
                })()}'''
    if old not in ct:
        raise SystemExit("cancel block missing")
    ct = ct.replace(old, new, 1)
    cv.write_text(ct)
    print("multi ok")

print("B done")
