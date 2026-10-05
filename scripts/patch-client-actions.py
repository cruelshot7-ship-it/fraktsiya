from pathlib import Path
p = Path("src/components/app/clients-view.tsx")
t = p.read_text()
if "actionClientId" in t and "Карточка клиента" in t:
    print("already")
    raise SystemExit(0)

t = t.replace(
    "  const [adding, setAdding] = useState(false);",
    "  const [adding, setAdding] = useState(false);\n  const [actionClientId, setActionClientId] = useState<string | null>(null);\n  const [confirmRemove, setConfirmRemove] = useState(false);",
    1,
)
t = t.replace(
    "  const openClientSheet = useStudio((s) => s.openClientSheet);",
    "  const openClientSheet = useStudio((s) => s.openClientSheet);\n  const removeClient = useStudio((s) => s.removeClient);\n  const cancelBooking = useStudio((s) => s.cancelBooking);",
    1,
)
old_btn = """          <button
            key={client.id}
            type="button"
            onClick={() => openClientSheet(client.id)}
            className={cn(
              "pressable relative overflow-hidden rounded-xl bg-card p-3.5 text-left shadow-border",
              flag.tone === "alert" && "glow-alert",
              flag.tone === "ok" && "glow-ok",
            )}
          >"""
new_btn = """          <button
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
if old_btn not in t:
    raise SystemExit("card button not found")
t = t.replace(old_btn, new_btn, 1)

action_ui = '''
      {actionClientId ? (() => {
        const client = clients.find((c) => c.id === actionClientId);
        if (!client) return null;
        const nextBooking = bookings
          .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
          .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0];
        return (
          <div className="fixed inset-0 z-[70] flex flex-col justify-end">
            <button
              type="button"
              className="absolute inset-0 bg-black/55"
              aria-label="Закрыть"
              onClick={() => {
                setActionClientId(null);
                setConfirmRemove(false);
              }}
            />
            <div className="relative z-[71] space-y-2 rounded-t-2xl border border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-border">
              <div className="mb-1 flex items-center gap-3">
                <Avatar initials={initials(client)} tone={clientFlag(client, today, food, bookings).tone} />
                <div className="min-w-0 flex-1">
                  <p className="font-display truncate text-base">{shortName(client)}</p>
                  <p className="text-tiny text-muted-foreground">
                    {client.sessionsLeft} {sessionsRu(client.sessionsLeft)}
                    {nextBooking
                      ? ` · след. ${nextBooking.date === today ? "сегодня" : formatDayMonth(nextBooking.date)} ${nextBooking.time}`
                      : " · нет записи"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="pressable flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground"
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
                disabled={!nextBooking}
                className={cn(
                  "pressable flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium",
                  nextBooking ? "bg-secondary text-foreground" : "bg-secondary/50 text-muted-foreground",
                )}
                onClick={() => {
                  if (!nextBooking) return;
                  cancelBooking(nextBooking.id, "trainer");
                  showToast(`Тренировка ${nextBooking.time} отменена · ${shortName(client)}`);
                  setActionClientId(null);
                  setConfirmRemove(false);
                }}
              >
                {nextBooking ? `Отменить тренировку · ${nextBooking.time}` : "Нет ближайшей тренировки"}
              </button>

              {!confirmRemove ? (
                <button
                  type="button"
                  className="pressable flex h-12 w-full items-center justify-center rounded-xl bg-primary/15 text-sm font-medium text-primary"
                  onClick={() => setConfirmRemove(true)}
                >
                  Удалить клиента
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="pressable h-12 flex-1 rounded-xl bg-secondary text-sm"
                    onClick={() => setConfirmRemove(false)}
                  >
                    Назад
                  </button>
                  <button
                    type="button"
                    className="pressable h-12 flex-1 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
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

              <button
                type="button"
                className="pressable flex h-11 w-full items-center justify-center text-sm text-muted-foreground"
                onClick={() => {
                  setActionClientId(null);
                  setConfirmRemove(false);
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        );
      })() : null}
'''

old_tail = """      </details>
    </div>
  );
}

export function ClientSheet"""
new_tail = """      </details>
""" + action_ui + """
    </div>
  );
}

export function ClientSheet"""
if old_tail not in t:
    raise SystemExit("tail not found")
t = t.replace(old_tail, new_tail, 1)
p.write_text(t)
print("ok", "Карточка клиента" in t)
