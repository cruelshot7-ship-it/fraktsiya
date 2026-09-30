import { useEffect, useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  addDays,
  clientFlag,
  daysAgoPhrase,
  dayKbju,
  formatDayMonth,
  formatPhone,
  FREEZE_OPTIONS,
  initials,
  isoDate,
  isFrozen,
  isSlotPast,
  MACHINES,
  BOT_USERNAME,
  PACK_VALID_DAYS,
  TRAINER_TG_ID,
  coachStatusLine,
  packDaysLeft,
  PACKS,
  programWeek,
  sessionsRu,
  relativeDayLabel,
  shortName,
  startOfWeek,
  visitSession,
  weightDelta,
  type Client,
} from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { openPhone, openTelegramUrl, openTrainerChat, inviteUrl, getTelegramUser } from "@/lib/telegram";
import { Avatar, Pill, ProgressRail, SectionLabel, Surface, Field, inputClass } from "@/components/app/bits";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { FilterChip, FoodEditor, Kpi, MacroMini, MeasuresEditor, ProgramEditor } from "@/components/app/client-editors";

export function ClientsView() {
  const clients = useStudio((s) => s.clients);
  const showToast = useStudio((s) => s.showToast);
  const food = useStudio((s) => s.food);
  const bookings = useStudio((s) => s.bookings);
  const clientFilter = useStudio((s) => s.clientFilter);
  const setClientFilter = useStudio((s) => s.setClientFilter);
  const setTab = useStudio((s) => s.setTab);
  const selectDay = useStudio((s) => s.selectDay);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const addClient = useStudio((s) => s.addClient);
  const refreshCloud = useStudio((s) => s.refreshCloud);
  const openGuestPreview = useStudio((s) => s.openGuestPreview);
  const slots = useStudio((s) => s.slots);
  const closedSlotIds = useStudio((s) => s.closedSlotIds);
  const joinRequests = useStudio((s) => s.joinRequests);
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);
  const coaches = useStudio((s) => s.coaches);
  const addCoach = useStudio((s) => s.addCoach);
  const removeCoach = useStudio((s) => s.removeCoach);
  const payCoach = useStudio((s) => s.payCoach);
  const today = isoDate(new Date());
  const [adding, setAdding] = useState(false);
  const [coachName, setCoachName] = useState("");
  const [coachUser, setCoachUser] = useState("");
  const me = getTelegramUser();
  const owner = !me || String(me.id) === TRAINER_TG_ID;
  const myLink = inviteUrl(BOT_USERNAME, `c_${me?.id ?? TRAINER_TG_ID}`);
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

  // TEMP_STUB_FULL_RESTORE_PENDING
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Клиенты: {clients.length}. Полный UI восстанавливается…</p>
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
          <span className="text-xs tabular-nums text-muted-foreground">{client.sessionsLeft ?? 0}</span>
        </button>
      ))}
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
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="sheet-in flex min-h-0 flex-1 flex-col px-5 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl">{shortName(client)}</h2>
          <button type="button" onClick={() => openClientSheet(null)} className="text-sm text-muted-foreground">
            Закрыть
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Баланс: {client.sessionsLeft ?? 0} · {client.phone || "без телефона"}
        </p>
      </div>
    </div>
  );
}
