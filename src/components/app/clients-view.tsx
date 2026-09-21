import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  clientFlag,
  daysAgoPhrase,
  DOW,
  formatDayMonth,
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
  WEEKDAY_TIMES,
  weightDelta,
  type Client,
  type ProgramSession,
} from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { Avatar, Field, inputClass, Pill, ProgressRail, SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";

export function ClientsView() {
  const clients = useStudio((s) => s.clients);
  const food = useStudio((s) => s.food);
  const bookings = useStudio((s) => s.bookings);
  const clientFilter = useStudio((s) => s.clientFilter);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const addClient = useStudio((s) => s.addClient);
  const today = isoDate(new Date());

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
      </div>

      <div className="stagger-in flex flex-col gap-2">
        {visible.map(({ client, flag, week }) => (
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
                  {client.programTitle} \u00b7 неделя {week}
                  {client.trainTimes[0] ? ` \u00b7 ${client.trainTimes[0]}` : ""}
                  {` \u00b7 ${client.sessionsLeft} ${sessionsRu(client.sessionsLeft)}`}
                </p>
                <div className="mt-2.5">
                  <ProgressRail
                    value={flag.eaten.calories}
                    max={client.kbju.calories}
                    tone={flag.tone === "alert" ? "alert" : "ok"}
                  />
                  <p className="mt-1 text-tiny text-muted-foreground">
                    {flag.eaten.calories} из {client.kbju.calories} ккал \u00b7 серия {client.streak}
                  </p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addClient()}
        className="pressable flex h-12 items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-sm text-muted-foreground"
      >
        <Plus className="size-4" />
        Добавить клиента
      </button>
    </div>
  );
}

function Kpi({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "ok" | "alert";
}) {
  return (
    <div>
      <p
        className={cn(
          "font-display text-3xl leading-none tabular-nums",
          tone === "ok" && "text-ok",
          tone === "alert" && "text-primary",
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 whitespace-pre-line text-2xs leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable h-8 rounded-full px-3 text-tiny font-medium",
        active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </button>
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
  const today = isoDate(new Date());
  const flag = clientFlag(client, today, food, bookings);
  const week = programWeek(client, today);
  return (
    <div className="sheet-in flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-3 px-5 pt-5 pb-3">
        <Avatar initials={initials(client)} tone={flag.tone} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-none">{shortName(client)}</p>
          <p className="mt-1 truncate text-tiny text-muted-foreground">
            {client.programTitle} \u00b7 неделя {week}
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
        <Surface>
          <SectionLabel>Баланс занятий</SectionLabel>
          <p className="font-display mt-2 text-3xl tabular-nums">
            {client.sessionsLeft}
            <span className="ml-2 text-base font-sans font-normal text-muted-foreground">{sessionsRu(client.sessionsLeft)}</span>
          </p>
        </Surface>
      </div>
    </div>
  );
}
