from pathlib import Path
import re
p = Path("src/components/app/clients-view.tsx")
t = p.read_text()
if "Отменить слот" in t:
    print("already")
    raise SystemExit(0)

# Remove global bottom sheet if present
t, n = re.subn(
    r"\n      \{actionClientId \? \(\(\) => \{.*?\}\)\(\) : null\}\n",
    "\n",
    t,
    count=1,
    flags=re.S,
)
print("sheet removed", n)

old = """          visible.map(({ client, flag }) => {
            const next = bookings
              .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
              .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0];
            return (
          <button
            key={client.id}
            type="button"
            onClick={() => {
              setActionClientId(client.id);
              setConfirmRemove(false);
            }}
            className={cn(
              "pressable relative overflow-hidden rounded-xl bg-card p-3.5 text-left shadow-border",
              flag.tone === "alert" && "glow-alert",
              flag.tone === "ok" && "glow-ok",
            )}
          >"""
new = """          visible.map(({ client, flag }) => {
            const next = bookings
              .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
              .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0];
            const open = actionClientId === client.id;
            return (
          <div key={client.id} className="space-y-1.5">
          <button
            type="button"
            onClick={() => {
              if (open) {
                setActionClientId(null);
                setConfirmRemove(false);
              } else {
                setActionClientId(client.id);
                setConfirmRemove(false);
              }
            }}
            className={cn(
              "pressable relative w-full overflow-hidden rounded-xl bg-card p-3.5 text-left shadow-border",
              flag.tone === "alert" && "glow-alert",
              flag.tone === "ok" && "glow-ok",
              open && "ring-1 ring-primary/40",
            )}
          >"""
if old not in t:
    raise SystemExit("start not found")
t = t.replace(old, new, 1)

old_end = """            </div>
          </button>
            );
          })"""
new_end = """            </div>
          </button>
          {open ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card/95 p-2 shadow-border">
              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  className="pressable flex h-11 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                  onClick={() => {
                    setActionClientId(null);
                    setConfirmRemove(false);
                    openClientSheet(client.id);
                  }}
                >
                  Карточка клиента
                </button>
                <button
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
                </button>
                {!confirmRemove ? (
                  <button
                    type="button"
                    className="pressable flex h-11 items-center justify-center rounded-lg bg-primary/15 text-sm font-medium text-primary"
                    onClick={() => setConfirmRemove(true)}
                  >
                    Удалить клиента
                  </button>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className="pressable h-11 flex-1 rounded-lg bg-secondary text-sm"
                      onClick={() => setConfirmRemove(false)}
                    >
                      Назад
                    </button>
                    <button
                      type="button"
                      className="pressable h-11 flex-1 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                      onClick={() => {
                        removeClient(client.id);
                        showToast(`Клиент ${shortName(client)} удалён`);
                        setActionClientId(null);
                        setConfirmRemove(false);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
          </div>
            );
          })"""
if old_end not in t:
    raise SystemExit("end not found")
t = t.replace(old_end, new_end, 1)
p.write_text(t)
print("ok")
