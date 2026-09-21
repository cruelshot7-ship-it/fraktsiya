import { useMemo, useState } from "react";
import {
  clientFlag,
  formatDayMonth,
  FREEZE_OPTIONS,
  initials,
  isoDate,
  isFrozen,
  PACKS,
  sessionsRu,
  shortName,
  type Client,
} from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { Avatar, Field, inputClass, Pill, ProgressRail, SectionLabel, Surface } from "@/components/app/bits";

export function ClientsView() {
  const clients = useStudio((s) => s.clients);
  const food = useStudio((s) => s.food);
  const bookings = useStudio((s) => s.bookings);
  const clientFilter = useStudio((s) => s.clientFilter);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const addClient = useStudio((s) => s.addClient);
  const today = isoDate(new Date());
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients
      .map((c) => ({ client: c, flag: clientFlag(c, today, food, bookings) }))
      .filter(({ client, flag }) => {
        if (needle && !`${client.firstName} ${client.lastName}`.toLowerCase().includes(needle)) return false;
        if (clientFilter === "attention") return flag.attention;
        if (clientFilter === "today") return flag.today;
        return true;
      });
  }, [bookings, clientFilter, clients, food, q, today]);

  return (
    <div className="stagger-in flex flex-col gap-3">
      <div className="flex gap-1.5">
        {(["all", "today", "attention"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setClientFilter(id)}
            className={`pressable h-9 rounded-full px-3 text-tiny ${clientFilter === id ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            {id === "all" ? "Все" : id === "today" ? "Сегодня" : "Внимание"}
          </button>
        ))}
      </div>
      <input className={inputClass} placeholder="Найти клиента…" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.map(({ client, flag }) => (
        <button
          key={client.id}
          type="button"
          onClick={() => openClientSheet(client.id)}
          className="pressable flex items-center gap-3 rounded-xl bg-card px-3 py-3 text-left shadow-border"
        >
          <Avatar initials={initials(client)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{shortName(client)}</p>
            <p className="text-tiny text-muted-foreground">
              {client.sessionsLeft} {sessionsRu(client.sessionsLeft)}
              {flag.badge ? ` · ${flag.badge}` : ""}
            </p>
          </div>
          {flag.tone === "alert" ? <Pill tone="alert">!</Pill> : flag.today ? <Pill tone="ok">сегодня</Pill> : null}
        </button>
      ))}
      <button
        type="button"
        className="pressable h-12 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => {
          const id = addClient();
          if (id) openClientSheet(id);
        }}
      >
        Новый клиент
      </button>
    </div>
  );
}

export function ClientSheet() {
  const sheetClientId = useStudio((s) => s.sheetClientId);
  const clients = useStudio((s) => s.clients);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const creditSessions = useStudio((s) => s.creditSessions);
  const freezeClient = useStudio((s) => s.freezeClient);
  const unfreezeClient = useStudio((s) => s.unfreezeClient);
  const updateClient = useStudio((s) => s.updateClient);
  const client = clients.find((c) => c.id === sheetClientId) ?? null;
  if (!client) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70">
      <div className="sheet-in max-h-[92dvh] w-full max-w-app overflow-y-auto rounded-t-3xl bg-card px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{client.firstName} {client.lastName}</h2>
          <button type="button" className="text-sm text-muted-foreground" onClick={() => openClientSheet(null)}>
            Закрыть
          </button>
        </div>
        <p className="mt-1 text-tiny text-muted-foreground">
          {client.sessionsLeft} {sessionsRu(client.sessionsLeft)}
          {isFrozen(client) && client.frozenUntil ? ` · заморозка до ${formatDayMonth(client.frozenUntil)}` : ""}
        </p>
        <div className="mt-4">
          <SectionLabel>Зачислить</SectionLabel>
        </div>
        <div className="mt-2 flex gap-2">
          {PACKS.map((n) => (
            <button
              key={n}
              type="button"
              className="pressable h-11 flex-1 rounded-xl bg-ok text-sm font-medium text-ok-foreground"
              onClick={() => creditSessions(client.id, n)}
            >
              +{n}
            </button>
          ))}
        </div>
        <div className="mt-4">
          <SectionLabel>Заморозка</SectionLabel>
        </div>
        <div className="mt-2 flex gap-2">
          {FREEZE_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              className="pressable h-11 flex-1 rounded-xl bg-secondary text-sm"
              onClick={() => freezeClient(client.id, d)}
            >
              {d} дн
            </button>
          ))}
        </div>
        {isFrozen(client) ? (
          <button
            type="button"
            className="pressable mt-2 h-11 w-full rounded-xl bg-primary text-sm text-primary-foreground"
            onClick={() => unfreezeClient(client.id)}
          >
            Снять заморозку
          </button>
        ) : null}
        <WeightField client={client} onSave={(kg) => updateClient(client.id, { weight: kg })} />
      </div>
    </div>
  );
}

function WeightField({ client, onSave }: { client: Client; onSave: (kg: number) => void }) {
  const [kg, setKg] = useState(String(client.weight));
  return (
    <div className="mt-4">
      <Field label="Вес, кг">
        <input className={inputClass} inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} />
      </Field>
      <button
        type="button"
        className="pressable mt-2 h-11 w-full rounded-xl bg-secondary text-sm"
        onClick={() => {
          const n = Number(kg);
          if (n > 30 && n < 250) onSave(n);
        }}
      >
        Сохранить вес
      </button>
      <ProgressRail value={client.sessionsLeft} max={12} tone="ok" />
    </div>
  );
}
