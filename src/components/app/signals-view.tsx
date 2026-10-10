import { useState } from "react";
import { Bell, X } from "lucide-react";
import { CANCEL_WINDOWS, relativeLabel, type Notice } from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { Field, inputClass, SectionLabel, Surface } from "@/components/app/bits";
import { ActionCenter } from "@/components/app/action-center";
import { CsvImportPanel } from "@/components/app/csv-import-panel";
import { TrainerShareCard } from "@/components/app/trainer-share";
import { OutboxPanel } from "@/components/app/outbox-panel";
import { SyncStatusChip } from "@/components/app/sync-status";
import { cn } from "@/lib/utils";
import { joinConfirmText, joinRejectText } from "@/lib/join-confirm";

type Pane = "tasks" | "settings" | "tools";

/**
 * Сигналы тренера: задачи отдельно от настроек и тяжёлых инструментов.
 */
export function SignalsView() {
  const [pane, setPane] = useState<Pane>("tasks");
  const notices = useStudio((s) => s.notices);
  const dismissed = useStudio((s) => s.dismissedSignalIds);
  const dismissSignal = useStudio((s) => s.dismissSignal);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const setNotifyPrefs = useStudio((s) => s.setNotifyPrefs);
  const setTab = useStudio((s) => s.setTab);
  const selectDay = useStudio((s) => s.selectDay);
  const bookings = useStudio((s) => s.bookings);
  const slots = useStudio((s) => s.slots);
  const joinRequests = useStudio((s) => s.joinRequests);
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);

  const pending = joinRequests.filter((r) => r.status === "pending");
  const items = notices
    .filter((n) => n.audience === "trainer" && n.kind !== "join" && !dismissed.includes(n.id))
    .sort((a, b) => b.at.localeCompare(a.at));
  const openCount = pending.length + items.length;

  // the day a signal is about: its own slot when it names one, else the client's nearest booking
  const dayOf = (item: (typeof items)[number]) => {
    const slot = item.slotId ? slots.find((x) => x.id === item.slotId) : undefined;
    if (slot) return slot.date;
    return bookings.find((b) => b.clientId === item.clientId && !b.noShow)?.date;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-xl bg-secondary/80 p-1">
        {(
          [
            ["tasks", openCount ? `Задачи · ${openCount}` : "Задачи"],
            ["settings", "Правила"],
            ["tools", "Инструменты"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "pressable h-9 flex-1 rounded-lg text-xs font-medium",
              pane === id ? "bg-card shadow-border" : "text-muted-foreground",
            )}
            onClick={() => setPane(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {pane === "tasks" ? (
        <>
          <ActionCenter />
          <SyncStatusChip />

          {pending.map((req) => (
            <div key={req.id} className="rounded-xl bg-card px-4 py-3 shadow-border glow-ok">
              <p className="text-2xs font-medium tracking-wide text-ok uppercase">Заявка в зал</p>
              <p className="font-display mt-1 text-base">
                {req.firstName} {req.lastName}
              </p>
              {req.telegramUsername ? (
                <p className="text-tiny text-muted-foreground">@{req.telegramUsername}</p>
              ) : null}
              <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                {req.message || "Выбрал пакет и время"}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                  onClick={() => {
                    if (window.confirm(joinConfirmText(req))) approveJoin(req.id);
                  }}
                >
                  Принять
                </button>
                <button
                  type="button"
                  className="pressable h-11 rounded-xl bg-secondary text-sm"
                  onClick={() => {
                    if (window.confirm(joinRejectText(req))) rejectJoin(req.id);
                  }}
                >
                  Отклонить
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && pending.length === 0 ? (
            <div className="grid min-h-40 place-items-center px-6 text-center">
              <div>
                <Bell className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-display text-lg">Открытых задач нет</p>
                <p className="mt-1 text-sm text-muted-foreground">Отмены, записи и отчёты появятся здесь.</p>
              </div>
            </div>
          ) : (
            <div className="stagger-in flex flex-col gap-2">
              {items.map((item) => (
                <SignalCard
                  key={item.id}
                  item={item}
                  onOpen={() => {
                    if (item.clientId) openClientSheet(item.clientId);
                    if (item.kind === "book" || item.kind === "cancel" || item.kind === "checkin") {
                      const day = dayOf(item);
                      if (day) selectDay(day);
                    }
                  }}
                  onDismiss={() => dismissSignal(item.id)}
                  onOffer={
                    item.kind === "cancel" || item.kind === "book"
                      ? () => {
                          const day = dayOf(item);
                          if (day) selectDay(day);
                          setTab("slots");
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </>
      ) : null}

      {pane === "settings" ? (
        <Surface>
          <SectionLabel>Отмена и списание</SectionLabel>
          <p className="mt-2 text-sm leading-relaxed">
            Свободная отмена — пока до слота больше {notifyPrefs.windowHours} ч. Позже клиент может
            отменить, но занятие сгорает.
          </p>
          <div className="mt-3 flex gap-1.5">
            {CANCEL_WINDOWS.map((hours) => {
              const active = notifyPrefs.windowHours === hours;
              return (
                <button
                  key={hours}
                  type="button"
                  onClick={() => setNotifyPrefs({ windowHours: hours })}
                  className={cn(
                    "pressable h-9 rounded-lg px-3 text-xs",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {hours} ч
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm leading-relaxed">Нет визита — через сколько дней писать в утренней сводке.</p>
          <div className="mt-2 flex gap-1.5">
            {[7, 10, 14].map((days) => {
              const active = (notifyPrefs.absentDays || 10) === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setNotifyPrefs({ absentDays: days })}
                  className={cn(
                    "pressable h-9 rounded-lg px-3 text-xs",
                    active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {days} дн
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-1">
            <PrefRow
              label="Писать мне, если клиент отменил"
              on={notifyPrefs.notifyTrainer}
              onToggle={() => setNotifyPrefs({ notifyTrainer: !notifyPrefs.notifyTrainer })}
            />
            <PrefRow
              label="Писать клиенту, если отменил я"
              on={notifyPrefs.notifyClient}
              onToggle={() => setNotifyPrefs({ notifyClient: !notifyPrefs.notifyClient })}
            />
            <PrefRow
              label="Списывать занятие при поздней отмене"
              on={notifyPrefs.flagLate}
              onToggle={() => setNotifyPrefs({ flagLate: !notifyPrefs.flagLate })}
            />
          </div>
          <Field label="Адрес зала">
            <input
              className={inputClass}
              value={notifyPrefs.address || ""}
              onChange={(e) => setNotifyPrefs({ address: e.target.value })}
              placeholder="Минск, улица, дом"
            />
          </Field>
          <p className="mt-1 text-tiny text-muted-foreground">Клиент увидит кнопку «Маршрут» у своей записи.</p>
        </Surface>
      ) : null}

      {pane === "tools" ? (
        <>
          <CsvImportPanel />
          <TrainerShareCard />
          <OutboxPanel />
          <SyncStatusChip />
        </>
      ) : null}
    </div>
  );
}

function PrefRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-11 items-center justify-between gap-3 rounded-lg px-1 text-left"
    >
      <span className="text-sm">{label}</span>
      <span className={cn("relative h-6 w-10 rounded-full", on ? "bg-ok" : "bg-secondary")}>
        <span
          className={cn(
            "absolute top-1 size-4 rounded-full bg-foreground transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            on ? "translate-x-5" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

function SignalCard({
  item,
  onOpen,
  onDismiss,
  onOffer,
}: {
  item: Notice;
  onOpen: () => void;
  onDismiss: () => void;
  onOffer?: () => void;
}) {
  const alert =
    item.kind === "alert" || item.kind === "food" || item.kind === "cancel" || item.kind === "noshow";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-card p-4 shadow-border",
        alert ? "glow-alert" : "glow-ok",
      )}
    >
      <span
        className={cn("absolute inset-y-3 left-0 w-0.5 rounded-full", alert ? "bg-primary" : "bg-ok")}
      />
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium leading-snug">{item.title}</p>
          <p className="mt-1 text-tiny text-muted-foreground">{item.body}</p>
          <div className="mt-2 flex items-center gap-2">
            {item.kind === "cancel" ? (
              <span className={cn("text-2xs font-medium", item.late ? "text-primary" : "text-ok")}>
                {item.late ? "списание" : "отмена"}
              </span>
            ) : item.kind === "wallet" ? (
              <span className="text-2xs font-medium text-ok">баланс</span>
            ) : item.kind === "checkin" ? (
              <span className="text-2xs font-medium text-ok">чек-ин</span>
            ) : item.kind === "noshow" ? (
              <span className="text-2xs font-medium text-primary">неявка</span>
            ) : item.kind === "waitlist" ? (
              <span className="text-2xs font-medium text-ok">лист</span>
            ) : null}
            <p className="text-2xs text-muted-foreground">{relativeLabel(item.at)}</p>
          </div>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground"
          aria-label="Готово"
          title="Закрыть задачу"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="pressable h-9 rounded-lg bg-secondary px-3 text-xs font-medium"
        >
          Открыть
        </button>
        {onOffer ? (
          <button
            type="button"
            onClick={onOffer}
            className="pressable h-9 rounded-lg bg-secondary px-3 text-xs font-medium"
          >
            К слотам
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDismiss}
          className="pressable h-9 rounded-lg bg-ok/15 px-3 text-xs font-medium text-ok"
        >
          Готово
        </button>
      </div>
    </div>
  );
}
