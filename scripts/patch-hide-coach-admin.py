from pathlib import Path

p = Path("src/components/app/clients-view.tsx")
t = p.read_text()
if "Команда тренеров" in t and "teamOpen" in t:
    print("already")
    raise SystemExit(0)

# add state
if "const [teamOpen, setTeamOpen]" not in t:
    t = t.replace(
        "  const [confirmRemove, setConfirmRemove] = useState(false);",
        "  const [confirmRemove, setConfirmRemove] = useState(false);\n  const [teamOpen, setTeamOpen] = useState(false);",
        1,
    )

# extract and remove the owner coaches block from invite surface
old_block = """        {owner ? (
          <div className="mt-4">
            <SectionLabel>Другие тренеры</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input className={inputClass} value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Имя" />
              <input className={inputClass} value={coachUser} onChange={(e) => setCoachUser(e.target.value)} placeholder="@username" />
            </div>
            <button
              type="button"
              className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm"
              onClick={() => {
                if (!coachName.trim() || !coachUser.trim()) {
                  showToast("Нужны имя и @username.");
                  return;
                }
                void addCoach(coachUser, coachName);
                setCoachName("");
                setCoachUser("");
              }}
            >
              Дать доступ
            </button>
            {coaches.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {coaches.map((coach) => {
                  const token = coach.code || coach.telegramId;
                  const link = token ? inviteUrl(BOT_USERNAME, `c_${token}`) : "";
                  return (
                    <div key={coach.code || coach.username || coach.firstName} className="rounded-lg bg-secondary px-3 py-2">
                      <button
                        type="button"
                        className="pressable w-full text-left"
                        onClick={() => {
                          if (!link) {
                            showToast("Пусть тренер сначала откроет бота.");
                            return;
                          }
                          void navigator.clipboard?.writeText(link);
                          showToast("Ссылка тренера скопирована");
                        }}
                      >
                        <p className="text-xs text-foreground">
                          {coach.firstName} · @{coach.username}
                          {coach.telegramId ? "" : " · ещё не открыл бота"}
                        </p>
                        <p className="mt-1 text-tiny text-muted-foreground">{link || "Ссылка появится после входа"}</p>
                        <p className="mt-1 text-tiny text-foreground">{coachStatusLine(coach)}</p>
                      </button>
                      <button
                        type="button"
                        className="pressable mt-2 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                        onClick={() => void payCoach(coach)}
                      >
                        Оплачено · $10
                      </button>
                      <button
                        type="button"
                        className="pressable mt-2 h-11 w-full rounded-lg bg-card text-sm text-primary"
                        onClick={() => void removeCoach(coach)}
                      >
                        Удалить полностью
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
"""

if old_block not in t:
    raise SystemExit("owner coach block missing")
t = t.replace(old_block, "", 1)

# insert collapsible team section before final closing of main flex col
# Find last part - typically ends with adding form or coaches was mid-file
# Insert before the closing `    </div>\n  );\n}` of the component

marker = "\n    </div>\n  );\n}\n"
# use last occurrence of the return close - the ClientsView function end
idx = t.rfind("    </div>\n  );\n}")
if idx < 0:
    raise SystemExit("component end missing")

team = """
      {owner ? (
        <div className="mt-2 space-y-2 border-t border-hairline/40 pt-3">
          <button
            type="button"
            className="pressable flex h-11 w-full items-center justify-between rounded-xl bg-card px-4 text-left shadow-border"
            onClick={() => setTeamOpen((v) => !v)}
          >
            <span className="text-sm font-medium">Команда тренеров</span>
            <span className="text-tiny text-muted-foreground">
              {teamOpen ? "скрыть" : coaches.length ? `${coaches.length} · открыть` : "открыть"}
            </span>
          </button>
          {teamOpen ? (
            <Surface>
              <p className="text-tiny text-muted-foreground">
                Доступ субарендаторам. Не смешивается со списком ваших клиентов.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input className={inputClass} value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="Имя" />
                <input className={inputClass} value={coachUser} onChange={(e) => setCoachUser(e.target.value)} placeholder="@username" />
              </div>
              <button
                type="button"
                className="pressable mt-2 h-11 w-full rounded-lg bg-secondary text-sm"
                onClick={() => {
                  if (!coachName.trim() || !coachUser.trim()) {
                    showToast("Нужны имя и @username.");
                    return;
                  }
                  void addCoach(coachUser, coachName);
                  setCoachName("");
                  setCoachUser("");
                }}
              >
                Дать доступ
              </button>
              {coaches.length > 0 ? (
                <div className="mt-3 flex flex-col gap-2">
                  {coaches.map((coach) => {
                    const token = coach.code || coach.telegramId;
                    const link = token ? inviteUrl(BOT_USERNAME, `c_${token}`) : "";
                    return (
                      <div key={coach.code || coach.username || coach.firstName} className="rounded-lg bg-secondary px-3 py-2">
                        <button
                          type="button"
                          className="pressable w-full text-left"
                          onClick={() => {
                            if (!link) {
                              showToast("Пусть тренер сначала откроет бота.");
                              return;
                            }
                            void navigator.clipboard?.writeText(link);
                            showToast("Ссылка тренера скопирована");
                          }}
                        >
                          <p className="text-xs text-foreground">
                            {coach.firstName} · @{coach.username}
                            {coach.telegramId ? "" : " · ещё не открыл бота"}
                          </p>
                          <p className="mt-1 text-tiny text-muted-foreground">{link || "Ссылка появится после входа"}</p>
                          <p className="mt-1 text-tiny text-foreground">{coachStatusLine(coach)}</p>
                        </button>
                        <button
                          type="button"
                          className="pressable mt-2 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                          onClick={() => void payCoach(coach)}
                        >
                          Оплачено · $10
                        </button>
                        <button
                          type="button"
                          className="pressable mt-2 h-11 w-full rounded-lg bg-card text-sm text-primary"
                          onClick={() => void removeCoach(coach)}
                        >
                          Удалить полностью
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-tiny text-muted-foreground">Пока никого. Добавьте по имени и @username.</p>
              )}
            </Surface>
          ) : null}
        </div>
      ) : null}
"""

t = t[:idx] + team + t[idx:]
p.write_text(t)
print("ok")
