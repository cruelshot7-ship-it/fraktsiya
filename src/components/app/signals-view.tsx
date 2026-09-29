import { X } from "lucide-react";
import { CANCEL_WINDOWS, relativeLabel, type Notice } from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { ActionCenter } from "@/components/app/action-center";
import { CsvImportPanel } from "@/components/app/csv-import-panel";
import { TrainerShareCard } from "@/components/app/trainer-share";
import { OutboxPanel } from "@/components/app/outbox-panel";
import { cn } from "@/lib/utils";

export function SignalsView() {
  const notices = useStudio((s) => s.notices);
  const dismissed = useStudio((s) => s.dismissedSignalIds);
  const dismissSignal = useStudio((s) => s.dismissSignal);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const notifyPrefs = useStudio((s) => s.notifyPrefs);
  const setNotifyPrefs = useStudio((s) => s.setNotifyPrefs);
  const setTab = useStudio((s) => s.setTab);
  const joinRequests = useStudio((s) => s.joinRequests);
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);

  const pending = joinRequests.filter((r) => r.status === "pending");
  const items = notices
    .filter((n) => n.audience === "trainer" && n.kind !== "join" && !dismissed.includes(n.id))
    .sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-3">
      <ActionCenter />
      <CsvImportPanel />
      <TrainerShareCard />
      <OutboxPanel />
      <Surface>
        <SectionLabel>Уведомления об отмене</SectionLabel>
        <p className="mt-2 text-sm leading-relaxed">
          Свободная отмена — пока до слота больше {notifyPrefs.windowHours} ч.
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
                  "pressable h-10 flex-1 rounded-lg text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {hours} ч
              </button>
            );
          })}
        </div>
      </Surface>

      {pending.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SectionLabel>Заявки в зал</SectionLabel>
          {pending.map((req) => (
            <Surface key={req.id} glow="alert">
              <p className="text-sm font-medium">{req.firstName}</p>
              <p className="mt-1 whitespace-pre-line text-tiny text-muted-foreground">{req.message}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" className="pressable h-10 rounded-lg bg-ok text-xs font-medium text-ok-foreground" onClick={() => approveJoin(req.id)}>
                  Принять
                </button>
                <button type="button" className="pressable h-10 rounded-lg bg-secondary text-xs" onClick={() => rejectJoin(req.id)}>
                  Отклонить
                </button>
              </div>
            </Surface>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <SectionLabel>Сигналы</SectionLabel>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока тихо.</p>
        ) : (
          items.map((n: Notice) => (
            <Surface key={n.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="mt-1 text-tiny text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-2xs text-muted-foreground">{relativeLabel(n.at)}</p>
                </div>
                <button type="button" className="text-muted-foreground" onClick={() => dismissSignal(n.id)} aria-label="Скрыть">
                  <X className="size-4" />
                </button>
              </div>
              {n.clientId ? (
                <button type="button" className="pressable mt-2 text-xs text-primary" onClick={() => openClientSheet(n.clientId!)}>
                  Карточка клиента
                </button>
              ) : null}
            </Surface>
          ))
        )}
      </div>

      <button type="button" className="self-start text-xs text-muted-foreground" onClick={() => setTab("bookings")}>
        К записям
      </button>
    </div>
  );
}
