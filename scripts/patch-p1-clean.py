from pathlib import Path

p = Path("src/lib/studio-store.ts")
t = p.read_text()
if "4 занятия на балансе" not in t:
    if "buildProgram" not in t:
        t = t.replace("  emptyClient,\n", "  emptyClient,\n  buildProgram,\n", 1)
    old = """    const fresh = existing
      ? null
      : {
          ...emptyClient(),
          id: `tg_${req.telegramId}`,
          firstName: req.firstName,
          lastName: req.lastName,
          telegramId: req.telegramId,
          telegramUsername: req.telegramUsername,
          coachId: req.coachId || String(getTelegramUser()?.id || TRAINER_TG_ID),
        };
    const clientId = existing?.id ?? fresh!.id;
    const notice: Notice = {
      id: `nt_ok_${req.telegramId}`,
      audience: "client",
      clientId,
      kind: "join",
      title: "Вас приняли в зал",
      body: "Можно записываться. Тренер назначит программу и пакет.",
      at: new Date().toISOString(),
    };
    const nextClients = fresh
      ? [...get().clients, fresh]
      : get().clients.map((c) =>
          c.id === existing!.id ? { ...c, telegramId: req.telegramId, telegramUsername: req.telegramUsername ?? c.telegramUsername } : c,
        );"""
    new = """    const today = todayIso();
    const starter = buildProgram({ weight: 0, trainDays: [0, 2, 4] }, "shape", "beginner");
    const packTxn = {
      id: `txn_join_${req.telegramId}`,
      clientId: existing?.id ?? `tg_${req.telegramId}`,
      kind: "credit" as const,
      at: new Date().toISOString(),
      delta: 4,
      note: "Пакет при входе в зал",
    };
    const fresh = existing
      ? null
      : {
          ...emptyClient(),
          id: `tg_${req.telegramId}`,
          firstName: req.firstName,
          lastName: req.lastName,
          telegramId: req.telegramId,
          telegramUsername: req.telegramUsername,
          coachId: req.coachId || String(getTelegramUser()?.id || TRAINER_TG_ID),
          sessionsLeft: 4,
          ledger: [packTxn],
          programTitle: starter.programTitle,
          sessions: starter.sessions,
          programStart: today,
          programWeeks: 8,
          trainDays: [0, 2, 4],
        };
    const clientId = existing?.id ?? fresh!.id;
    const notice: Notice = {
      id: `nt_ok_${req.telegramId}`,
      audience: "client",
      clientId,
      kind: "join",
      title: "Вас приняли в зал",
      body: "4 занятия на балансе · программа новичка. Можно записываться.",
      at: new Date().toISOString(),
    };
    const nextClients = fresh
      ? [...get().clients, fresh]
      : get().clients.map((c) => {
          if (c.id !== existing!.id) return c;
          const needsPack = (c.sessionsLeft ?? 0) <= 0;
          const needsProg = !c.sessions?.length;
          return {
            ...c,
            telegramId: req.telegramId,
            telegramUsername: req.telegramUsername ?? c.telegramUsername,
            sessionsLeft: needsPack ? 4 : c.sessionsLeft,
            ledger: needsPack ? [...(c.ledger ?? []), packTxn] : c.ledger,
            programTitle: needsProg ? starter.programTitle : c.programTitle,
            sessions: needsProg ? starter.sessions : c.sessions,
            programStart: needsProg ? today : c.programStart,
            trainDays: c.trainDays?.length ? c.trainDays : [0, 2, 4],
          };
        });"""
    if old not in t:
        raise SystemExit("approveJoin missing")
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("store ok")
else:
    print("store already")

ap = Path("src/lib/action-items.ts")
at = ap.read_text()
start = at.find("export function clientActionItems")
end = at.find("export function trainerActionItems")
if start >= 0 and end > start:
    body = at[start:end]
    body2 = body.replace('tab: "bookings"', 'tab: "schedule"').replace('tab: "slots"', 'tab: "schedule"')
    ap.write_text(at[:start] + body2 + at[end:])
    print("actions ok")
