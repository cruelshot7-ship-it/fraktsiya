import { useEffect, useMemo, useState } from "react";
import { Bell, CalendarDays, MessageCircle, Users } from "lucide-react";
import { formatDayMonth, hoursUntilSlot, isFrozen, isSlotPast, relativeLabel, sessionsRu, type Notice } from "@/data/studio";
import { activeClient, useStudio, type TabId } from "@/lib/studio-store";
import { Toast } from "@/components/app/bits";
import { BrandLockup } from "@/components/app/brand-mark";
import { HapticLayer } from "@/components/app/haptic-layer";
import { SlotsView } from "@/components/app/slots-view";
import { BookingsView } from "@/components/app/bookings-view";
import { ProgramView } from "@/components/app/program-view";
import { NutritionView } from "@/components/app/nutrition-view";
import { HallView } from "@/components/app/hall-view";
import { ClientSheet, ClientsView } from "@/components/app/clients-view";
import { JoinGate } from "@/components/app/join-gate";
import { SignalsView } from "@/components/app/signals-view";
import { cn } from "@/lib/utils";
import { primeFoodDb } from "@/lib/barcode";
import { initTelegram, getTelegramUser, openTrainerChat } from "@/lib/telegram";
import { TRAINER_TG_ID } from "@/data/studio";

const CLIENT_TABS: { id: TabId; label: string }[] = [
  { id: "slots", label: "Слоты" },
  { id: "bookings", label: "Записи" },
  { id: "program", label: "Сегодня" },
  { id: "food", label: "Еда" },
  { id: "hall", label: "Зал" },
];

const TRAINER_NAV: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "clients", label: "Клиенты", icon: Users },
  { id: "slots", label: "Слоты", icon: CalendarDays },
  { id: "signals", label: "Сигналы", icon: Bell },
];

const TITLES: Record<TabId, string> = {
  slots: "Слоты",
  bookings: "Мои записи",
  program: "Сегодня",
  food: "Питание",
  hall: "Зрение зала",
  clients: "Клиенты",
  signals: "Сигналы",
};

export function MiniApp() {
  const hydrate = useStudio((s) => s.hydrate);
  const refreshCloud = useStudio((s) => s.refreshCloud);
  const tab = useStudio((s) => s.tab);
  const setTab = useStudio((s) => s.setTab);
  const role = useStudio((s) => s.role);
  const setRole = useStudio((s) => s.setRole);
  const toast = useStudio((s) => s.toast);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const notices = useStudio((s) => s.notices);
  const dismissed = useStudio((s) => s.dismissedSignalIds);
  const dismissSignal = useStudio((s) => s.dismissSignal);
  const bookings = useStudio((s) => s.bookings);
  const sheetClientId = useStudio((s) => s.sheetClientId);
  const trainerUsername = useStudio((s) => s.trainerUsername);
  const inviteBlocked = useStudio((s) => s.inviteBlocked);
  const showToast = useStudio((s) => s.showToast);
  const client = activeClient({ clients, activeClientId });
  const [inboxOpen, setInboxOpen] = useState(false);
  const [tgLocked, setTgLocked] = useState(false);

  useEffect(() => {
    initTelegram();
    let tries = 0;
    let booted = false;
    const boot = () => {
      const user = getTelegramUser();
      setTgLocked(Boolean(user));
      if (!booted && (user || tries >= 10)) {
        booted = true;
        hydrate();
      }
      return Boolean(user) || String(user?.id ?? "") === String(TRAINER_TG_ID);
    };
    boot();
    const timer = window.setInterval(() => {
      tries += 1;
      if (boot() || tries > 10) window.clearInterval(timer);
    }, 150);
    void primeFoodDb();
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void primeFoodDb(true);
        refreshCloud();
      }
    };
    const onOnline = () => {
      void primeFoodDb(true);
      refreshCloud();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    const ping = window.setInterval(() => void primeFoodDb(true), 5 * 60 * 1000);
    const cloud = window.setInterval(() => refreshCloud(), 12_000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(cloud);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.clearInterval(ping);
    };
  }, [hydrate, refreshCloud]);

  const joinRequests = useStudio((s) => s.joinRequests);
  const trainerBadge =
    notices.filter((n) => n.audience === "trainer" && n.kind !== "join" && !dismissed.includes(n.id)).length +
    joinRequests.filter((r) => r.status === "pending").length;
  const clientInbox = notices.filter((n) => n.audience === "client" && n.clientId === client?.id && !dismissed.includes(n.id));
  const nextMine = bookings
    .filter((b) => b.clientId === client?.id && !isSlotPast(b.date, b.time))
    .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))[0];
  const soon = nextMine ? hoursUntilSlot(nextMine.date, nextMine.time) : null;

  const title = useMemo(() => {
    if (role === "trainer") return TITLES[tab] ?? "Клиенты";
    if (inviteBlocked) return "Заявка в зал";
    if (tab === "program") return client ? `${client.firstName} · сегодня` : TITLES.program;
    if (tab === "slots") return "Запись на тренировку";
    return TITLES[tab];
  }, [tab, client, role, inviteBlocked]);

  return (
    <div className="flex min-h-dvh justify-center bg-background">
      <HapticLayer />
      <div className="ambient-glow relative flex min-h-dvh w-full max-w-app flex-col pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]">
        <Toast message={toast} />

        {sheetClientId ? null : (
        <header className="relative z-10 px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-3">
          {role === "trainer" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <BrandLockup compact />
                {tgLocked ? null : <RoleSwitch role={role} onChange={setRole} compact />}
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <h1 key={title} className="title-in font-display text-4xl leading-none tracking-wide">
                  {title}
                </h1>
                <button
                  type="button"
                  onClick={() => setTab("signals")}
                  className="pressable relative grid size-11 place-items-center rounded-2xl bg-secondary text-muted-foreground"
                  aria-label="Сигналы"
                >
                  <Bell className="size-4" />
                  {trainerBadge > 0 ? (
                    <span className="glow-dot absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
                  ) : null}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <BrandLockup />
                {inviteBlocked ? null : (
                <div className="flex items-center gap-1.5">
                  {tgLocked ? null : <RoleSwitch role={role} onChange={setRole} />}
                  <button
                    type="button"
                    onClick={() => {
                      openTrainerChat(trainerUsername);
                    }}
                    className="pressable relative grid size-11 place-items-center rounded-full bg-ok-dim text-ok"
                    aria-label="Написать тренеру"
                  >
                    <MessageCircle className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setInboxOpen(true)}
                    className="pressable relative grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground"
                    aria-label="Уведомления"
                  >
                    <Bell className="size-4" />
                    {clientInbox.length > 0 ? (
                      <span className="glow-dot absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" />
                    ) : null}
                  </button>
                </div>
                )}
              </div>
              {inviteBlocked ? null : (
              <>
              <h1 key={title} className="title-in font-display mt-3 text-2xl leading-none tracking-wide">
                {title}
              </h1>
              <p className="mt-1.5 text-tiny text-muted-foreground">
                {!client
                  ? inviteBlocked
                    ? "Тренер добавит вас в зал"
                    : "Профиль появится, когда тренер добавит вас в зал"
                  : isFrozen(client)
                  ? `Заморозка до ${formatDayMonth(client.frozenUntil!)}`
                  : soon !== null && soon > 0 && soon < 24
                    ? `Ближайшая ${nextMine!.time} · ${client.sessionsLeft} ${sessionsRu(client.sessionsLeft)}`
                    : `${client.sessionsLeft} ${sessionsRu(client.sessionsLeft)} на балансе`}
              </p>
              </>
              )}
            </>
          )}
        </header>
        )}

        {role === "client" && !sheetClientId && !inviteBlocked ? (
          <div className="flex gap-1 px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]">
            {CLIENT_TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "pressable min-h-11 min-w-0 flex-1 border-b-2 py-2.5 text-center text-sm font-medium leading-tight transition-[color,border-color] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                    active ? "border-primary text-foreground" : "border-hairline text-muted-foreground",
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}

        <main
          className={cn(
            "flex-1 overflow-y-auto px-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))]",
            role === "trainer" ? "pb-24" : "pb-10",
          )}
        >
          <div key={`${role}-${tab}`} className="pt-4">
            {inviteBlocked && role === "client" ? (
              <JoinGate />
            ) : (
              <>
            {tab === "slots" ? <SlotsView /> : null}
            {tab === "bookings" ? <BookingsView /> : null}
            {tab === "program" ? <ProgramView /> : null}
            {tab === "food" ? <NutritionView /> : null}
            {tab === "hall" ? <HallView /> : null}
            {tab === "clients" ? <ClientsView /> : null}
            {tab === "signals" ? <SignalsView /> : null}
              </>
            )}
          </div>
        </main>

        {role === "trainer" ? (
          <nav className="nav-blur absolute inset-x-0 bottom-0 z-20 border-t border-hairline">
            <div className="flex px-2 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))]">
              {TRAINER_NAV.map((item) => {
                const active = tab === item.id;
                const Icon = item.icon;
                const badge = item.id === "signals" ? trainerBadge : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                    "pressable relative flex min-h-11 flex-1 flex-col items-center gap-0.5 py-2 text-2xs",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {active ? <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" /> : null}
                    <span className="relative">
                      <Icon className="size-5" />
                      {badge > 0 ? (
                        <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-3xs font-medium text-primary-foreground">
                          {badge}
                        </span>
                      ) : null}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : null}

        {sheetClientId ? <ClientSheet /> : null}
        {inboxOpen && role === "client" ? (
          <InboxSheet
            items={clientInbox}
            onClose={() => setInboxOpen(false)}
            onDismiss={(id) => dismissSignal(id)}
            onRebook={() => {
              setInboxOpen(false);
              setTab("slots");
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function RoleSwitch({
  role,
  onChange,
  compact,
}: {
  role: "client" | "trainer";
  onChange: (role: "client" | "trainer") => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-0.5 rounded-full bg-secondary p-0.5", compact && "opacity-80")}>
      <button
        type="button"
        onClick={() => onChange("client")}
        className={cn(
          "pressable font-medium",
          compact ? "h-7 px-2.5 text-3xs" : "h-8 px-3 text-2xs",
          role === "client" ? "rounded-full bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
      >
        Клиент
      </button>
      <button
        type="button"
        onClick={() => onChange("trainer")}
        className={cn(
          "pressable font-medium",
          compact ? "h-7 px-2.5 text-3xs" : "h-8 px-3 text-2xs",
          role === "trainer" ? "rounded-full bg-primary text-primary-foreground" : "text-muted-foreground",
        )}
      >
        Тренер
      </button>
    </div>
  );
}

function InboxSheet({
  items,
  onClose,
  onDismiss,
  onRebook,
}: {
  items: Notice[];
  onClose: () => void;
  onDismiss: (id: string) => void;
  onRebook: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background">
      <div className="sheet-in flex min-h-0 flex-1 flex-col px-5 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">Уведомления</h2>
          <button type="button" onClick={onClose} className="text-sm text-muted-foreground">
            Закрыть
          </button>
        </div>
        <div className="mt-4 flex-1 overflow-y-auto pb-8">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Пока тихо. Если тренер отменит или перенесёт — придёт сюда.
            </p>
          ) : (
            <div className="stagger-in flex flex-col gap-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl bg-card p-4",
                    item.kind === "cancel" ? "shadow-glow-alert" : "shadow-border",
                  )}
                >
                  {item.kind === "cancel" ? (
                    <p className="text-2xs font-medium tracking-wide text-primary uppercase">Отмена записи</p>
                  ) : item.kind === "reschedule" ? (
                    <p className="text-2xs font-medium tracking-wide text-ok uppercase">Перенос</p>
                  ) : item.kind === "wallet" ? (
                    <p className="text-2xs font-medium tracking-wide text-ok uppercase">Баланс</p>
                  ) : item.kind === "waitlist" ? (
                    <p className="text-2xs font-medium tracking-wide text-ok uppercase">Лист ожидания</p>
                  ) : item.kind === "freeze" ? (
                    <p className="text-2xs font-medium tracking-wide text-primary uppercase">Заморозка</p>
                  ) : item.kind === "book" ? (
                    <p className="text-2xs font-medium tracking-wide text-ok uppercase">Запись</p>
                  ) : null}
                  <p className="mt-1 text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-tiny text-muted-foreground">{item.body}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-2xs text-muted-foreground">{relativeLabel(item.at)}</p>
                    <button type="button" className="text-tiny text-muted-foreground" onClick={() => onDismiss(item.id)}>
                      скрыть
                    </button>
                  </div>
                  {item.kind === "cancel" ? (
                    <button
                      type="button"
                      onClick={onRebook}
                      className="pressable mt-3 h-11 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                    >
                      Выбрать другое время
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
