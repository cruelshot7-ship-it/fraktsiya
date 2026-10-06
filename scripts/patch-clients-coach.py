from pathlib import Path

p = Path("src/components/app/clients-view.tsx")
t = p.read_text()

if "Другие тренеры" in t:
    print("already")
    raise SystemExit(0)

# import clientCoach
if "clientCoach" not in t:
    t = t.replace(
        "  clientFlag,\n",
        "  clientFlag,\n  clientCoach,\n",
        1,
    )

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
    raise SystemExit("visible block missing")
t = t.replace(old_vis, new_vis, 1)

# filter chip count: mine only for Все
t = t.replace(
    "Все {clients.length}",
    "Все {mineRows.length}{otherRows.length ? ` · +${otherRows.length}` : \"\"}",
    1,
)

old_list = """      <div className="stagger-in flex flex-col gap-2">
        {visible.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground shadow-border">
            Пока никого. Добавьте клиента: имя и телефон или @username.
          </p>
        ) : (
          visible.map(({ client, flag }) => {
"""
new_list = """      <div className="stagger-in flex flex-col gap-2">
        {mineRows.length === 0 && otherRows.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground shadow-border">
            Пока никого. Добавьте клиента: имя и телефон или @username.
          </p>
        ) : null}

        {mineRows.length > 0 ? (
          <>
            <SectionLabel>Мои клиенты · {mineRows.length}</SectionLabel>
            {mineRows.map(({ client, flag }) => {
"""
if old_list not in t:
    raise SystemExit("list start missing")
t = t.replace(old_list, new_list, 1)

# close the map and add otherRows section - find the end of visible.map
# The map ends with:          })}
        )}
      </div>
 before coaches section typically

marker = """          })}
        )}
      </div>
"""
# there may be multiple - find the one after actionClientId list (clients cards)
idx = t.find("Мои клиенты")
if idx < 0:
    raise SystemExit("mine header missing after replace")
# from mine map, find first closing of map+ternary after idx
rest = t[idx:]
# old closing for the ternary was visible.map ... })  )}
# after our change we have mineRows.map(({ client, flag }) => {
# need to close with })}
# then other section
# then null closing

# Find end of card map: look for pattern after "setConfirmRemove(false);" near remove
close_old = """          })}
        )}
      </div>

      {owner ? ("""

if close_old not in t[idx:]:
    # try without owner
    close_old2 = """          })}
        )}
      </div>
"""
    pos = t.find(close_old2, idx)
    if pos < 0:
        raise SystemExit("list close missing")
    # only first close after mine
    close_old = close_old2
else:
    pos = t.find(close_old, idx)

close_new = """          })}
          </>
        ) : null}

        {otherRows.length > 0 ? (
          <>
            <SectionLabel>Другие тренеры · {otherRows.length}</SectionLabel>
            <p className="text-tiny text-muted-foreground">Карточки видны в общей базе, но это не ваши клиенты.</p>
            {otherRows.map(({ client, flag }) => {
              const next = bookings
                .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
                .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0];
              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => openClientSheet(client.id)}
                  className="pressable relative overflow-hidden rounded-xl bg-card/70 px-4 py-3 text-left shadow-border opacity-90"
                >
                  <div className="flex items-start gap-3">
                    <Avatar initials={initials(client)} tone="none" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-base leading-tight">{shortName(client)}</p>
                      <p className="mt-0.5 truncate text-tiny text-muted-foreground">
                        тренер · {client.coachId || "—"}
                        {next
                          ? ` · ${next.date === today ? "сегодня" : formatDayMonth(next.date)} ${next.time}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        ) : null}
      </div>

      {owner ? ("""

if close_old not in t:
    # without owner branch
    close_new_plain = close_new.replace("\n\n      {owner ? (", "\n")
    # Actually if no owner, keep simple
    if close_old2 in t[idx:]:
        t = t[:idx] + rest.replace(close_old2, close_new.replace("\n\n      {owner ? (", "\n").split("\n      {owner")[0] + "\n", 1)
        # too messy
        raise SystemExit("need owner marker")
    raise SystemExit("close not found")

t = t.replace(close_old, close_new, 1)
p.write_text(t)
print("ok")
