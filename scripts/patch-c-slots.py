from pathlib import Path
import re

p = Path("src/components/app/client-slots.tsx")
t = p.read_text()
if "Подтвердить" in t and "confirmId" in t:
    print("already")
    raise SystemExit(0)

if "const [confirmId, setConfirmId]" not in t:
    t = t.replace(
        "const [pendingId, setPendingId] = useState<string | null>(null);",
        "const [pendingId, setPendingId] = useState<string | null>(null);\n  const [confirmId, setConfirmId] = useState<string | null>(null);",
        1,
    )

if "ring-ok/20" not in t:
    t, n = re.subn(
        r'className=\{cn\(\s*"ds-slot bg-card p-4",\s*mine && "is-mine",\s*past && "is-past",\s*\)\}',
        '''className={cn(
                  "ds-slot bg-card p-4",
                  mine && "is-mine ring-1 ring-ok/40",
                  !mine && !past && left > 0 && "ring-1 ring-ok/20",
                  !mine && !past && left <= 0 && "opacity-90",
                  past && "is-past",
                  confirmId === slot.id && "ring-1 ring-primary/50",
                )}''',
        t,
        count=1,
    )
    print("cls", n)

pat = re.compile(
    r'(left > 0 && !frozen \? \(\s*)(<button\s+type="button"\s+className="pressable ds-cta"[\s\S]*?</button>)(\s*\) : left <= 0 && !waiting \?)',
)
if not pat.search(t):
    raise SystemExit("btn missing")
new_btn = r'''\1{confirmId === slot.id ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <p className="text-2xs text-muted-foreground">−1 с баланса · {slot.time}</p>
                        <div className="flex gap-1.5">
                          <button type="button" className="pressable rounded-lg bg-secondary px-2.5 py-1.5 text-xs" onClick={() => setConfirmId(null)}>
                            Отмена
                          </button>
                          <button
                            type="button"
                            className="pressable ds-cta"
                            disabled={pendingId === slot.id}
                            onClick={() => {
                              if ((me.sessionsLeft ?? 0) <= 0) {
                                showToast("На балансе нет занятий. Напишите тренеру.");
                                setConfirmId(null);
                                return;
                              }
                              const overlap = clientBookingsConflict(
                                bookings
                                  .filter((b) => b.clientId === me.id && !b.noShow)
                                  .map((b) => ({
                                    date: b.date,
                                    time: b.time,
                                    durationMin: b.duration || 60,
                                  })),
                                {
                                  date: slot.date,
                                  time: slot.time,
                                  durationMin: slot.duration || 60,
                                },
                              );
                              if (overlap) {
                                showToast("У вас уже есть занятие в это время.");
                                setConfirmId(null);
                                return;
                              }
                              setPendingId(slot.id);
                              const ok = book(slot.id);
                              setPendingId(null);
                              setConfirmId(null);
                              if (ok) {
                                enqueueBookingConfirmed({
                                  telegramId: me.telegramId,
                                  bookingId: `local_${slot.id}_${me.id}`,
                                  clientId: me.id,
                                  date: slot.date,
                                  time: slot.time,
                                });
                                tryFlushPending();
                                showToast(`Записано · ${slot.time} · −1 занятие`);
                              }
                            }}
                          >
                            Подтвердить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="pressable ds-cta"
                        disabled={pendingId === slot.id}
                        onClick={() => {
                          if ((me.sessionsLeft ?? 0) <= 0) {
                            showToast("На балансе нет занятий. Напишите тренеру.");
                            return;
                          }
                          setConfirmId(slot.id);
                        }}
                      >
                        {(me.sessionsLeft ?? 0) <= 0 ? "Нет занятий" : "Записаться"}
                      </button>
                    )}\3'''
t = pat.sub(new_btn, t, count=1)
p.write_text(t)
print("C ok", "Подтвердить" in t)
