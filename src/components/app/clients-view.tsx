import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  clientFlag,
  daysAgoPhrase,
  dayKbju,
  formatDayMonth,
  formatPhone,
  FREEZE_OPTIONS,
  initials,
  isoDate,
  isFrozen,
  PACK_VALID_DAYS,
  packDaysLeft,
  PACKS,
  programWeek,
  sessionsRu,
  shortName,
  visitSession,
  weightDelta,
  type Client,
} from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { openPhone, openTelegramUrl, openTrainerChat } from "@/lib/telegram";
import { Avatar, Pill, ProgressRail, SectionLabel, Surface, Field, inputClass } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { FilterChip, FoodEditor, Kpi, MacroMini, MeasuresEditor, ProgramEditor } from "@/components/app/client-editors";

export function ClientsView() {
  const clients = useStudio((s) => s.clients);
  const food = useStudio((s) => s.food);
  const bookings = useStudio((s) => s.bookings);
  const clientFilter = useStudio((s) => s.clientFilter);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const addClient = useStudio((s) => s.addClient);
  const refreshCloud = useStudio((s) => s.refreshCloud);
  const openGuestPreview = useStudio((s) => s.openGuestPreview);
  const joinRequests = useStudio((s) => s.joinRequests);
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);
  const today = isoDate(new Date());
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tgUser, setTgUser] = useState("");
  const [phone, setPhone] = useState("");

  const rows = useMemo(
    () =>
      clients.map((client) => ({
        client,
        flag: clientFlag(client, today, food, bookings),
        week: programWeek(client, today),
      })),
    [clients, food, bookings, today],
  );

  const todayCount = rows.filter((r) => r.flag.today).length;
  const attentionCount = rows.filter((r) => r.flag.attention).length;
  const weekBookings = bookings.filter((b) => {
    const d = new Date(`${b.date}T00:00:00`);
    const now = new Date();
    const start = new Date(now);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return d >= start && d < end;
  }).length;

  const visible = rows.filter((r) => {
    if (clientFilter === "attention") return r.flag.attention;
    if (clientFilter === "today") return r.flag.today;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => openGuestPreview()}
        className="pressable rounded-xl bg-card px-4 py-3 text-left shadow-border"
      >
        <p className="text-sm font-medium">Как видит новичок</p>
        <p className="mt-1 text-tiny text-muted-foreground">Так новичок выбирает пакет и время. Заявка придёт вам.</p>
      </button>
      {joinRequests.filter((r) => r.status === "pending").length > 0 ? (
        <div className="flex flex-col gap-2">
          {joinRequests
            .filter((r) => r.status === "pending")
            .map((req) => (
              <div key={req.id} className="rounded-xl bg-card px-4 py-3 shadow-border">
                <p className="font-display text-base">
                  {req.firstName} {req.lastName}
                </p>
                {req.telegramUsername ? <p className="text-tiny text-muted-foreground">@{req.telegramUsername}</p> : null}
                <p className="mt-1 text-sm text-muted-foreground">{req.message || "Нажал Старт"}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                    onClick={() => approveJoin(req.id)}
                  >
                    Принять
                  </button>
                  <button type="button" className="pressable h-11 rounded-xl bg-secondary text-sm" onClick={() => rejectJoin(req.id)}>
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3 px-1 py-1">
        <Kpi value={todayCount} label={"тренировки\nсегодня"} tone="ok" />
        <Kpi value={attentionCount} label={"требуют\nвнимания"} tone="alert" />
        <Kpi value={weekBookings} label={"записей\nна неделю"} />
      </div>

      <div className="flex gap-1.5">
        <FilterChip active={clientFilter === "all"} onClick={() => setClientFilter("all")}>
          Все {clients.length}
        </FilterChip>
        <FilterChip active={clientFilter === "attention"} onClick={() => setClientFilter("attention")}>
          Внимание {attentionCount}
        </FilterChip>
        <FilterChip active={clientFilter === "today"} onClick={() => setClientFilter("today")}>
          Сегодня {todayCount}
        </FilterChip>
        <button type="button" onClick={() => refreshCloud()} className="ml-auto text-tiny text-muted-foreground">
          Обновить
        </button>
      </div>

      <div className="stagger-in flex flex-col gap-2">
        {visible.length === 0 ? (
          <p className="rounded-xl bg-card px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground shadow-border">
            Пока никого. Добавьте клиента: имя и телефон или @username.
          </p>
        ) : (
          visible.map(({ client, flag }) => (
          <button
            key={client.id}
            type="button"
            onClick={() => openClientSheet(client.id)}
            className={cn(
              "pressable relative overflow-hidden rounded-xl bg-card p-3.5 text-left shadow-border",
              flag.tone === "alert" && "glow-alert",
              flag.tone === "ok" && "glow-ok",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-3 left-0 w-0.5 rounded-full",
                flag.tone === "alert" && "bg-primary",
                flag.tone === "ok" && "bg-ok",
                flag.tone === "none" && "bg-transparent",
              )}
            />
            <div className="flex items-start gap-3">
              <Avatar initials={initials(client)} tone={flag.tone} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display truncate text-base leading-tight">{shortName(client)}</p>
                  {flag.badge ? <Pill tone={flag.tone === "ok" ? "ok" : "alert"}>{flag.badge}</Pill> : null}
                </div>
                <p className="mt-0.5 truncate text-tiny text-muted-foreground">
                  {client.telegramUsername
                    ? `@${client.telegramUsername}`
                    : client.phone
                      ? formatPhone(client.phone)
                      : client.programTitle || "без контакта"}
                  {` · ${client.sessionsLeft} ${sessionsRu(client.sessionsLeft)}`}
                </p>
                <div className="mt-2.5">
                  <ProgressRail
                    value={flag.eaten.calories}
                    max={dayKbju(client, today, bookings).kbju.calories}
                    tone={flag.tone === "alert" ? "alert" : "ok"}
                  />
                  <p className="mt-1 text-tiny text-muted-foreground">
                    {flag.eaten.calories} из {dayKbju(client, today, bookings).kbju.calories} ккал · серия {client.streak}
                  </p>
                </div>
              </div>
            </div>
          </button>
        )))}
      </div>

      {adding ? (
        <div className="rounded-xl bg-card p-4 shadow-border">
          <p className="font-display text-xs tracking-[0.08em] text-muted-foreground uppercase">Новый клиент</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Имя">
              <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Анна" />
            </Field>
            <Field label="Фамилия">
              <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Козлова" />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Телефон">
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 900 000-00-00"
                inputMode="tel"
              />
            </Field>
            <Field label="Telegram">
              <input className={inputClass} value={tgUser} onChange={(e) => setTgUser(e.target.value)} placeholder="@username" />
            </Field>
          </div>
          <p className="mt-2 text-tiny text-muted-foreground">
            Достаточно телефона или @ — как удобно. Программу и пакет назначите в карточке.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="h-11 rounded-lg bg-secondary text-sm" onClick={() => setAdding(false)}>
              Отмена
            </button>
            <button
              type="button"
              className="pressable h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => {
                if (!addClient({ firstName, lastName, telegramUsername: tgUser, phone })) return;
                const link = "https://t.me/ruksha_discipline_bot";
                openTelegramUrl(
                  `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Привет! Зал Ruksha: ${link} — нажми Старт`)}`,
                );
                setFirstName("");
                setLastName("");
                setTgUser("");
                setPhone("");
                setAdding(false);
              }}
            >
              Добавить
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="pressable flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-sm text-muted-foreground"
        >
          <Plus className="size-4" />
          Добавить клиента
        </button>
      )}
    </div>
  );
}

export function ClientSheet() {
  const sheetClientId = useStudio((s) => s.sheetClientId);
  const clients = useStudio((s) => s.clients);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const client = clients.find((c) => c.id === sheetClientId);
  if (!client) return null;
  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-background">
      <div className="ambient-glow flex min-h-0 flex-1 flex-col">
        <ClientSheetBody client={client} onClose={() => openClientSheet(null)} />
      </div>
    </div>
  );
}

function ClientSheetBody({ client, onClose }: { client: Client; onClose: () => void }) {
  const food = useStudio((s) => s.food);
  const bookings = useStudio((s) => s.bookings);
  const setActiveClient = useStudio((s) => s.setActiveClient);
  const setTab = useStudio((s) => s.setTab);
  const updateClient = useStudio((s) => s.updateClient);
  const removeClient = useStudio((s) => s.removeClient);
  const creditSessions = useStudio((s) => s.creditSessions);
  const freezeClient = useStudio((s) => s.freezeClient);
  const unfreezeClient = useStudio((s) => s.unfreezeClient);
  const showToast = useStudio((s) => s.showToast);
  const today = isoDate(new Date());
  const flag = clientFlag(client, today, food, bookings);
  const todayGoal = dayKbju(client, today, bookings);
  const week = programWeek(client, today);
  const session = visitSession(client, today, bookings);
  const delta = weightDelta(client.weightHistory);
  const frozen = isFrozen(client, today);
  const expires = packDaysLeft(client, today);
  const [mode, setMode] = useState<"view" | "program" | "food" | "measures">("view");
  const [chartReady, setChartReady] = useState(false);
  const [customAmt, setCustomAmt] = useState("8");
  useEffect(() => setChartReady(true), []);

  return (
    <div className="sheet-in flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 px-5 pt-5 pb-3">
        <Avatar initials={initials(client)} tone={flag.tone} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">{shortName(client)}</p>
          <p className="mt-1 truncate text-tiny text-muted-foreground">
            {client.programTitle} · неделя {week}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground"
          aria-label="Закрыть"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {flag.badge ? (
          <div className="mb-3">
            <Pill tone={flag.tone === "ok" ? "ok" : "alert"}>{flag.badge}</Pill>
          </div>
        ) : null}

        {mode === "view" ? (
          <div className="stagger-in flex flex-col gap-3">
            <Surface>
              <SectionLabel>Сегодня</SectionLabel>
              {session ? (
                <>
                  <p className="font-display mt-2 text-xl leading-tight">
                    {session.name}
                    <span className="ml-2 text-sm font-sans font-normal text-muted-foreground">
                      {client.trainTimes[0] ? `${client.trainTimes[0]} · ` : ""}
                      {session.items.length} упр.
                    </span>
                  </p>
                  <button
                    type="button"
                    className="pressable mt-3 h-11 w-full rounded-lg bg-secondary text-sm"
                    onClick={() => {
                      setActiveClient(client.id);
                      setTab("program");
                      onClose();
                    }}
                  >
                    Открыть программу
                  </button>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Сегодня тренировки нет.</p>
              )}
            </Surface>

            <Surface glow={frozen || client.sessionsLeft <= 2 ? "alert" : "ok"}>
              <SectionLabel>Баланс занятий</SectionLabel>
              <p className="font-display mt-2 text-3xl tabular-nums">
                {client.sessionsLeft}
                <span className="ml-2 text-base font-sans font-normal text-muted-foreground">{sessionsRu(client.sessionsLeft)}</span>
              </p>
              <p className="mt-1 text-tiny text-muted-foreground">
                {frozen
                  ? `Заморозка до ${formatDayMonth(client.frozenUntil!)}`
                  : expires === null
                    ? `Пакет действует ${PACK_VALID_DAYS} дней после зачисления`
                    : expires <= 0
                      ? "Срок пакета истёк — зачислите новый"
                      : `Пакет до ${formatDayMonth(client.packExpiresAt!)} · ${expires} дн.`}
              </p>
              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {PACKS.map((n) => (
                  <button
                    key={`p${n}`}
                    type="button"
                    onClick={() => creditSessions(client.id, n)}
                    className="pressable h-11 rounded-lg bg-secondary text-sm font-medium"
                  >
                    +{n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => creditSessions(client.id, 1)}
                  className="pressable h-11 rounded-lg bg-secondary text-sm font-medium"
                >
                  +1
                </button>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {PACKS.map((n) => (
                  <button
                    key={`m${n}`}
                    type="button"
                    disabled={client.sessionsLeft <= 0}
                    onClick={() => creditSessions(client.id, -n)}
                    className="pressable h-11 rounded-lg bg-secondary text-sm font-medium text-muted-foreground disabled:opacity-40"
                  >
                    −{n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={client.sessionsLeft <= 0}
                  onClick={() => creditSessions(client.id, -1)}
                  className="pressable h-11 rounded-lg bg-secondary text-sm font-medium text-muted-foreground disabled:opacity-40"
                >
                  −1
                </button>
              </div>
              <div className="mt-2 flex gap-1.5">
                <input
                  className={inputClass}
                  inputMode="numeric"
                  value={customAmt}
                  onChange={(e) => setCustomAmt(e.target.value.replace(/[^\d]/g, ""))}
                  aria-label="Своё количество"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = Number(customAmt);
                    if (!n) return;
                    creditSessions(client.id, n);
                  }}
                  className="pressable h-11 shrink-0 rounded-lg bg-ok px-3 text-sm font-medium text-ok-foreground"
                >
                  Зачислить
                </button>
                <button
                  type="button"
                  disabled={client.sessionsLeft <= 0}
                  onClick={() => {
                    const n = Number(customAmt);
                    if (!n) return;
                    creditSessions(client.id, -n);
                  }}
                  className="pressable h-11 shrink-0 rounded-lg bg-secondary px-3 text-sm disabled:opacity-40"
                >
                  Списать
                </button>
              </div>
              <div className="mt-4">
                <SectionLabel>Заморозка</SectionLabel>
              </div>
              {frozen ? (
                <button
                  type="button"
                  onClick={() => unfreezeClient(client.id)}
                  className="pressable mt-2 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                >
                  Снять заморозку
                </button>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {FREEZE_OPTIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => freezeClient(client.id, d)}
                      className="pressable h-11 rounded-lg bg-secondary text-sm"
                    >
                      {d} дн
                    </button>
                  ))}
                </div>
              )}
              {(client.ledger ?? []).length > 0 ? (
                <div className="mt-3 flex flex-col gap-1">
                  {client.ledger.slice(0, 4).map((t) => (
                    <p key={t.id} className="flex justify-between gap-2 text-tiny text-muted-foreground">
                      <span className="truncate">{t.note}</span>
                      <span className="tabular-nums">{t.delta > 0 ? `+${t.delta}` : t.delta || "0"}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-tiny text-muted-foreground">Зачисления появятся здесь.</p>
              )}
            </Surface>

            <Surface>
              <p className="text-tiny text-muted-foreground">{todayGoal.train ? "Тренировочный день" : "День отдыха"}</p>
              <p className="font-display mt-2 text-3xl tabular-nums">
                {flag.eaten.calories}
                <span className="ml-2 text-base text-muted-foreground">из {todayGoal.kbju.calories} ккал</span>
              </p>
              <div className="mt-2">
                <ProgressRail
                  value={flag.eaten.calories}
                  max={todayGoal.kbju.calories}
                  tone={flag.tone === "alert" ? "alert" : "ok"}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <MacroMini label="белки" now={flag.eaten.protein} max={todayGoal.kbju.protein} />
                <MacroMini label="жиры" now={flag.eaten.fat} max={todayGoal.kbju.fat} />
                <MacroMini label="углеводы" now={flag.eaten.carbs} max={todayGoal.kbju.carbs} />
              </div>
            </Surface>

            <Surface>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <SectionLabel>Вес</SectionLabel>
                  <p className="font-display mt-2 text-3xl tabular-nums">
                    {client.weight.toFixed(1).replace(".", ",")}
                    <span className="ml-1 text-base text-muted-foreground">кг</span>
                  </p>
                </div>
                <p className="text-tiny text-muted-foreground">
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1).replace(".", ",")} кг за 7 дней
                </p>
              </div>
              <div className="mt-2 h-24">
                {chartReady && client.weightHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={client.weightHistory} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <Tooltip
                        contentStyle={{
                          background: "var(--color-popover)",
                          border: "1px solid var(--color-border)",
                          borderRadius: 10,
                          fontSize: 12,
                          color: "var(--color-foreground)",
                        }}
                        formatter={(value) => [`${value} кг`, "вес"]}
                        labelFormatter={(label) => formatDayMonth(String(label))}
                      />
                      <Line type="monotone" dataKey="kg" stroke="var(--color-ok)" strokeWidth={2} dot={{ r: 3, fill: "var(--color-ok)" }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="grid h-full place-items-center text-sm text-muted-foreground">мало точек</p>
                )}
              </div>
            </Surface>

            <p className="text-tiny text-muted-foreground">Последний отчёт: {daysAgoPhrase(flag.daysSinceReport)}</p>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="pressable h-14 rounded-xl bg-secondary text-sm" onClick={() => setMode("program")}>
                Назначить программу
              </button>
              <button type="button" className="pressable h-14 rounded-xl bg-secondary text-sm" onClick={() => setMode("food")}>
                Изменить питание
              </button>
              <button type="button" className="pressable h-14 rounded-xl bg-secondary text-sm" onClick={() => setMode("measures")}>
                Фото и замеры
              </button>
              <button
                type="button"
                className="pressable h-14 rounded-xl bg-secondary text-sm"
                onClick={() => {
                  if (client.telegramUsername) {
                    openTrainerChat(client.telegramUsername);
                    return;
                  }
                  if (openPhone(client.phone)) return;
                  showToast("Нет телефона и @username — допишите в карточке.");
                }}
              >
                Написать
              </button>
            </div>
          </div>
        ) : null}

        {mode === "program" ? (
          <ProgramEditor
            client={client}
            onBack={() => setMode("view")}
            onSave={(patch) => {
              updateClient(client.id, patch);
              showToast("Программа обновлена. День A — первый визит недели.");
              setMode("view");
            }}
          />
        ) : null}
        {mode === "food" ? (
          <FoodEditor
            client={client}
            onBack={() => setMode("view")}
            onSave={(patch) => {
              updateClient(client.id, patch);
              showToast("КБЖУ: тренировка и день отдыха.");
              setMode("view");
            }}
          />
        ) : null}
        {mode === "measures" ? (
          <MeasuresEditor
            client={client}
            onBack={() => setMode("view")}
            onSave={(patch) => {
              updateClient(client.id, patch);
              showToast("Замеры сохранены.");
              setMode("view");
            }}
            onRemove={() => {
              removeClient(client.id);
              onClose();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
