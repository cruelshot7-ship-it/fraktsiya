from pathlib import Path
import re

# --- A: today-view ---
today = Path("src/components/app/today-view.tsx")
today.write_text(Path("/dev/null").read_text() if False else """import { useMemo } from \"react\";
import { ActionCenter } from \"@/components/app/action-center\";
import { SoftReturnPanel } from \"@/components/app/soft-return\";
import { ProgramView } from \"@/components/app/program-view\";
import { BookingsView } from \"@/components/app/bookings-view\";
import { useStudio } from \"@/lib/studio-store\";
import { SectionLabel, Surface } from \"@/components/app/bits\";
import { daysSince, isoDate, isSlotPast } from \"@/data/studio\";

export function TodayView() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const joinRequests = useStudio((s) => s.joinRequests);
  const setTab = useStudio((s) => s.setTab);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const today = isoDate(new Date());

  const summary = useMemo(() => {
    const todayRows = bookings.filter((b) => b.date === today && !b.noShow);
    const upcoming = todayRows
      .filter((b) => !isSlotPast(b.date, b.time))
      .sort((a, b) => a.time.localeCompare(b.time));
    const needMark = todayRows.filter((b) => isSlotPast(b.date, b.time) && !b.checkedIn && !b.noShow);
    const lowPack = clients.filter((c) => (c.sessionsLeft ?? 0) <= 2).length;
    const silent = clients.filter((c) => {
      const d = daysSince(c.lastReportAt, today);
      return d === null || d >= 7;
    }).length;
    const joins = joinRequests.filter((r) => r.status === \"pending\").length;
    return {
      todayCount: todayRows.length,
      nextTime: upcoming[0]?.time ?? null,
      needMark: needMark.length,
      lowPack,
      silent,
      joins,
    };
  }, [bookings, clients, joinRequests, today]);

  if (role === \"trainer\") {
    return (
      <div className=\"space-y-4\">
        <div>
          <SectionLabel>Сегодня</SectionLabel>
          <p className=\"mt-1 text-tiny text-muted-foreground\">Сводка зала · задачи · записи</p>
        </div>
        <div className=\"grid grid-cols-2 gap-2\">
          <button type=\"button\" className=\"pressable text-left\" onClick={() => setTab(\"bookings\")}>
            <Surface glow={summary.todayCount ? \"ok\" : undefined} className=\"h-full\">
              <p className=\"text-2xs tracking-wide text-muted-foreground uppercase\">Записей сегодня</p>
              <p className=\"mt-1 font-display text-2xl tabular-nums leading-none\">{summary.todayCount}</p>
              <p className=\"mt-1.5 text-tiny text-muted-foreground\">
                {summary.nextTime ? `ближайшая ${summary.nextTime}` : \"нет окон\"}
              </p>
            </Surface>
          </button>
          <button type=\"button\" className=\"pressable text-left\" onClick={() => setTab(\"bookings\")}>
            <Surface glow={summary.needMark ? \"alert\" : undefined} className=\"h-full\">
              <p className=\"text-2xs tracking-wide text-muted-foreground uppercase\">Без отметки</p>
              <p className=\"mt-1 font-display text-2xl tabular-nums leading-none\">{summary.needMark}</p>
              <p className=\"mt-1.5 text-tiny text-muted-foreground\">явка после слота</p>
            </Surface>
          </button>
          <button
            type=\"button\"
            className=\"pressable text-left\"
            onClick={() => {
              setClientFilter(\"attention\");
              setTab(\"clients\");
            }}
          >
            <Surface glow={summary.lowPack || summary.silent ? \"alert\" : undefined} className=\"h-full\">
              <p className=\"text-2xs tracking-wide text-muted-foreground uppercase\">Внимание</p>
              <p className=\"mt-1 font-display text-2xl tabular-nums leading-none\">
                {summary.lowPack + summary.silent}
              </p>
              <p className=\"mt-1.5 text-tiny text-muted-foreground\">мало занятий · тишина 7д</p>
            </Surface>
          </button>
          <button type=\"button\" className=\"pressable text-left\" onClick={() => setTab(\"signals\")}>
            <Surface glow={summary.joins ? \"alert\" : undefined} className=\"h-full\">
              <p className=\"text-2xs tracking-wide text-muted-foreground uppercase\">Заявки</p>
              <p className=\"mt-1 font-display text-2xl tabular-nums leading-none\">{summary.joins}</p>
              <p className=\"mt-1.5 text-tiny text-muted-foreground\">в зал · pending</p>
            </Surface>
          </button>
        </div>
        <ActionCenter />
        <BookingsView />
      </div>
    );
  }

  return (
    <div className=\"space-y-4\">
      <div>
        <SectionLabel>Мой день</SectionLabel>
        <p className=\"mt-1 text-tiny text-muted-foreground\">Что сделать сейчас · программа · прогресс</p>
      </div>
      <SoftReturnPanel />
      <ActionCenter />
      <ProgramView />
    </div>
  );
}
""")
print("today ok")

# --- B: shortName ---
studio = Path("src/data/studio.ts")
st = studio.read_text()
old_sn = """export function shortName(client: Pick<Client, \"firstName\" | \"lastName\">) {
  return `${client.firstName} ${client.lastName.charAt(0)}.`;
}"""
new_sn = """export function shortName(client: Pick<Client, \"firstName\" | \"lastName\">) {
  const last = (client.lastName ?? \"\").trim();
  if (!last) return client.firstName;
  return `${client.firstName} ${last.charAt(0)}.`;
}"""
if old_sn in st:
    st = st.replace(old_sn, new_sn, 1)
    print("shortName ok")
elif "if (!last) return client.firstName" in st:
    print("shortName already")
else:
    raise SystemExit("shortName missing")

old_flag = """  const daysSinceReport = daysSince(client.lastReportAt, today);
  const eaten = sumFood(food.filter((f) => f.date === today && f.clientId === client.id));
  const target = dayKbju(client, today, bookings).kbju;
  const lowCal = eaten.calories > 0 && target.calories > 0 && eaten.calories < target.calories * 0.72;
  const noReport = daysSinceReport >= 3;
  const lateOften = (client.lateCancels ?? 0) >= 2;
  const lowPack = (client.sessionsLeft ?? 0) <= 2;
  const frozen = isFrozen(client, today);
  const expiring = packDaysLeft(client, today);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const todayTrain = client.trainDays.includes(dowIndex(today));
  const todayOn = Boolean(todayBook || todayTrain);
  const attention = noReport || lowCal || lateOften || lowPack || frozen || (expiring !== null && expiring <= 7);
  let badge: string | null = null;
  let tone: ClientFlag[\"tone\"] = \"none\";
  if (frozen) {
    badge = `заморозка до ${formatDayMonth(client.frozenUntil!)}`;
    tone = \"alert\";
  } else if (noReport) {
    badge = `нет отчёта ${daysSinceReport} ${daysRu(daysSinceReport)}`;
    tone = \"alert\";
  } else if (lateOften) {"""
new_flag = """  const daysSinceReport = daysSince(client.lastReportAt, today);
  const eaten = sumFood(food.filter((f) => f.date === today && f.clientId === client.id));
  const target = dayKbju(client, today, bookings).kbju;
  const lowCal = eaten.calories > 0 && target.calories > 0 && eaten.calories < target.calories * 0.72;
  const hasReport = Boolean(client.lastReportAt);
  const noReport = hasReport && daysSinceReport >= 3;
  const neverReported = !hasReport;
  const lateOften = (client.lateCancels ?? 0) >= 2;
  const lowPack = (client.sessionsLeft ?? 0) <= 2;
  const frozen = isFrozen(client, today);
  const expiring = packDaysLeft(client, today);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const todayTrain = client.trainDays.includes(dowIndex(today));
  const todayOn = Boolean(todayBook || todayTrain);
  const attention =
    noReport || neverReported || lowCal || lateOften || lowPack || frozen || (expiring !== null && expiring <= 7);
  let badge: string | null = null;
  let tone: ClientFlag[\"tone\"] = \"none\";
  if (frozen) {
    badge = `заморозка до ${formatDayMonth(client.frozenUntil!)}`;
    tone = \"alert\";
  } else if (noReport && daysSinceReport <= 60) {
    badge = `нет отчёта ${daysSinceReport} ${daysRu(daysSinceReport)}`;
    tone = \"alert\";
  } else if (noReport || neverReported) {
    badge = \"нет отчёта\";
    tone = \"alert\";
  } else if (lateOften) {"""
if old_flag in st:
    st = st.replace(old_flag, new_flag, 1)
    print("flag ok")
elif "neverReported" in st:
    print("flag already")
else:
    raise SystemExit("flag missing")
studio.write_text(st)

# --- B multi cancel in clients-view ---
cv = Path("src/components/app/clients-view.tsx")
ct = cv.read_text()
if "future.slice(0, 4)" not in ct:
    old = """                <button
                  type=\"button\"
                  disabled={!next}
                  className={cn(
                    \"pressable flex h-11 items-center justify-center rounded-lg text-sm font-medium\",
                    next ? \"bg-secondary text-foreground\" : \"bg-secondary/50 text-muted-foreground\",
                  )}
                  onClick={() => {
                    if (!next) return;
                    cancelBooking(next.id, \"trainer\");
                    showToast(
                      `Отменено · ${next.date === today ? \"сегодня\" : formatDayMonth(next.date)} ${next.time} · ${shortName(client)}`,
                    );
                    setActionClientId(null);
                    setConfirmRemove(false);
                  }}
                >
                  {next
                    ? `Отменить слот · ${next.date === today ? \"сегодня\" : formatDayMonth(next.date)} ${next.time}`
                    : \"Нет ближайшего слота\"}
                </button>"""
    new = """                {(() => {
                  const future = bookings
                    .filter((b) => b.clientId === client.id && !isSlotPast(b.date, b.time))
                    .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`));
                  if (!future.length) {
                    return (
                      <button
                        type=\"button\"
                        disabled
                        className=\"pressable flex h-11 items-center justify-center rounded-lg bg-secondary/50 text-sm font-medium text-muted-foreground\"
                      >
                        Нет ближайшего слота
                      </button>
                    );
                  }
                  return future.slice(0, 4).map((row) => (
                    <button
                      key={row.id}
                      type=\"button\"
                      className=\"pressable flex h-11 items-center justify-center rounded-lg bg-secondary text-sm font-medium text-foreground\"
                      onClick={() => {
                        cancelBooking(row.id, \"trainer\");
                        showToast(
                          `Отменено · ${row.date === today ? \"сегодня\" : formatDayMonth(row.date)} ${row.time} · ${shortName(client)}`,
                        );
                        setActionClientId(null);
                        setConfirmRemove(false);
                      }}
                    >
                      Отменить слот · {row.date === today ? \"сегодня\" : formatDayMonth(row.date)} {row.time}
                    </button>
                  ));
                })()}"""
    if old not in ct:
        raise SystemExit("clients cancel block missing")
    ct = ct.replace(old, new, 1)
    cv.write_text(ct)
    print("clients multi ok")
else:
    print("clients multi already")

# --- C: client-slots confirm ---
cs = Path("src/components/app/client-slots.tsx")
cs_t = cs.read_text()
if "Подтвердить" not in cs_t:
    if "confirmId" not in cs_t:
        cs_t = cs_t.replace(
            "const [pendingId, setPendingId] = useState<string | null>(null);",
            "const [pendingId, setPendingId] = useState<string | null>(null);\n  const [confirmId, setConfirmId] = useState<string | null>(null);",
            1,
        )
    cs_t, n = re.subn(
        r'className=\{cn\(\s*"ds-slot bg-card p-4",\s*mine && "is-mine",\s*past && "is-past",\s*\)\}',
        '''className={cn(
                  "ds-slot bg-card p-4",
                  mine && "is-mine ring-1 ring-ok/40",
                  !mine && !past && left > 0 && "ring-1 ring-ok/20",
                  !mine && !past && left <= 0 && "opacity-90",
                  past && "is-past",
                  confirmId === slot.id && "ring-1 ring-primary/50",
                )}''',
        cs_t,
        count=1,
    )
    print("cls", n)
    pat = re.compile(
        r'(\): left > 0 && !frozen \? \(\s*)(<button\s+type="button"\s+className="pressable ds-cta"[\s\S]*?</button>)(\s*\) : left <= 0 && !waiting \?)',
    )
    m = pat.search(cs_t)
    if not m:
        raise SystemExit("book btn missing")
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
                                showToast("На балансе нет занятий.");
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
                            showToast("На балансе нет занятий.");
                            return;
                          }
                          setConfirmId(slot.id);
                        }}
                      >
                        {(me.sessionsLeft ?? 0) <= 0 ? "Нет занятий" : "Записаться"}
                      </button>
                    )}\3'''
    cs_t = pat.sub(new_btn, cs_t, count=1)
    cs.write_text(cs_t)
    print("slots ok")
else:
    print("slots already")

print("ALL DONE")
