from pathlib import Path

t = Path("src/components/app/clients-view.tsx").read_text()
if "mineRows" in t and "Общая база" in t:
    print("already")
    raise SystemExit(0)

if "clientCoach" not in t:
    t = t.replace("  clientFlag,\n", "  clientFlag,\n  clientCoach,\n", 1)

old_vis = """  const visible = rows.filter((r) => {
    if (clientFilter === "attention") return r.flag.attention;
    if (clientFilter === "today") return r.flag.today;
    return true;
  });
"""
new_vis = """  const visible = rows.filter((r) => {
    if (clientFilter === "attention") return r.flag.attention;
    if (clientFilter === "today") return r.flag.today;
    return true;
  });
  const myCoachKey = String(me?.id ?? TRAINER_TG_ID);
  const mineRows = visible.filter((r) => clientCoach(r.client) === myCoachKey);
  const otherRows = visible.filter((r) => clientCoach(r.client) !== myCoachKey);
"""
if old_vis not in t:
    raise SystemExit("visible missing")
t = t.replace(old_vis, new_vis, 1)

t = t.replace(
    "Все {clients.length}",
    "Все {mineRows.length}{otherRows.length ? ` · +${otherRows.length}` : \"\"}",
    1,
)

start = t.find('      <div className="stagger-in flex flex-col gap-2">')
if start < 0:
    raise SystemExit("list start missing")
marker = """          })
        )}
      </div>

      {adding ? ("""
pos = t.find(marker, start)
if pos < 0:
    raise SystemExit("list close missing")
chunk = t[start:pos]
ms = chunk.find("visible.map(")
if ms < 0:
    raise SystemExit("map missing")
map_fn = chunk[ms + len("visible.map(") :] + "          }\n"

new_section = (
    """      <div className=\"stagger-in flex flex-col gap-2\">
        {mineRows.length === 0 && otherRows.length === 0 ? (
          <p className=\"rounded-xl bg-card px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground shadow-border\">
            Пока никого. Добавьте клиента: имя и телефон или @username.
          </p>
        ) : null}

        {mineRows.length > 0 ? (
          <>
            <SectionLabel>Мои клиенты · {mineRows.length}</SectionLabel>
            {mineRows.map("""
    + map_fn
    + """)}
          </>
        ) : null}

        {otherRows.length > 0 ? (
          <>
            <SectionLabel>Другие тренеры · {otherRows.length}</SectionLabel>
            <p className=\"text-tiny text-muted-foreground\">Общая база · не ваши клиенты. Карточка только для просмотра.</p>
            {otherRows.map(({ client }) => {
              const next = bookings
                .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
                .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0];
              return (
                <button
                  key={client.id}
                  type=\"button\"
                  onClick={() => openClientSheet(client.id)}
                  className=\"pressable relative overflow-hidden rounded-xl bg-card/70 px-4 py-3 text-left shadow-border opacity-90\"
                >
                  <div className=\"flex items-start gap-3\">
                    <Avatar initials={initials(client)} tone=\"none\" />
                    <div className=\"min-w-0 flex-1\">
                      <p className=\"font-display truncate text-base leading-tight\">{shortName(client)}</p>
                      <p className=\"mt-0.5 truncate text-tiny text-muted-foreground\">
                        тренер · {client.coachId || \"—\"}
                        {next
                          ? ` · ${next.date === today ? \"сегодня\" : formatDayMonth(next.date)} ${next.time}`
                          : \"\"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        ) : null}
      </div>

      {adding ? ("""
)

t = t[:start] + new_section + t[pos + len(marker) :]
Path("src/components/app/clients-view.tsx").write_text(t)
print("ok")
