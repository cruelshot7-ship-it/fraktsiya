import { useMemo, useState } from "react";
import {
  initials,
  isoDate,
  shortName,
  clientFlag,
  programWeek,
  type Client,
} from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { Avatar, SectionLabel, Surface } from "@/components/app/bits";
import { Plus, X } from "lucide-react";

export function ClientsView() {
  const clients = useStudio((s) => s.clients);
  const food = useStudio((s) => s.food);
  const bookings = useStudio((s) => s.bookings);
  const setTab = useStudio((s) => s.setTab);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const addClient = useStudio((s) => s.addClient);
  const showToast = useStudio((s) => s.showToast);
  const today = isoDate(new Date());
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const rows = useMemo(
    () =>
      clients.map((client) => ({
        client,
        flag: clientFlag(client, today, food, bookings),
        week: programWeek(client, today),
      })),
    [clients, food, bookings, today],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Клиенты · {clients.length}</SectionLabel>
        <button
          type="button"
          className="pressable flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" /> Добавить
        </button>
      </div>

      {adding ? (
        <Surface className="space-y-2 p-3">
          <input
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Имя"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            placeholder="Фамилия"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="pressable flex-1 rounded-xl bg-primary py-2 text-sm text-primary-foreground"
              onClick={() => {
                if (!firstName.trim()) return;
                addClient({ firstName: firstName.trim(), lastName: lastName.trim() });
                showToast("Клиент добавлен");
                setFirstName("");
                setLastName("");
                setAdding(false);
              }}
            >
              Сохранить
            </button>
            <button
              type="button"
              className="pressable rounded-xl bg-secondary px-3 py-2 text-sm"
              onClick={() => setAdding(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Surface>
      ) : null}

      {rows.map(({ client, flag }) => (
        <button
          key={client.id}
          type="button"
          className="pressable flex w-full items-center gap-3 rounded-xl bg-card p-3 text-left shadow-border"
          onClick={() => openClientSheet(client.id)}
        >
          <Avatar name={initials(client)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{shortName(client)}</p>
            <p className="text-tiny text-muted-foreground">{flag}</p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {client.sessionsLeft ?? 0}
          </span>
        </button>
      ))}

      <button
        type="button"
        className="pressable w-full rounded-xl bg-secondary py-2 text-sm"
        onClick={() => setTab("schedule")}
      >
        К расписанию
      </button>
    </div>
  );
}

export function ClientSheet() {
  const sheetClientId = useStudio((s) => s.sheetClientId);
  const clients = useStudio((s) => s.clients);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const setTab = useStudio((s) => s.setTab);
  const client = clients.find((c) => c.id === sheetClientId);
  if (!client) return null;
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="sheet-in flex min-h-0 flex-1 flex-col px-5 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{shortName(client)}</h2>
          <button
            type="button"
            onClick={() => openClientSheet(null)}
            className="text-sm text-muted-foreground"
          >
            Закрыть
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Баланс: {client.sessionsLeft ?? 0} · {client.phone || "без телефона"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="pressable rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
            onClick={() => {
              openClientSheet(null);
              setTab("schedule");
            }}
          >
            Записать на слот
          </button>
          <button
            type="button"
            className="pressable rounded-xl bg-secondary px-3 py-2 text-sm"
            onClick={() => {
              openClientSheet(null);
              setTab("program");
            }}
          >
            Программа
          </button>
        </div>
      </div>
    </div>
  );
}
