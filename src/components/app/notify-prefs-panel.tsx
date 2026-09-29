import { useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";

/** TZ 2.2 — notification type toggles; no spam defaults beyond prefs. */
export function NotifyPrefsPanel() {
  const role = useStudio((s) => s.role);
  const prefs = useStudio((s) => s.notifyPrefs);
  const setNotifyPrefs = useStudio((s) => s.setNotifyPrefs);

  return (
    <Surface>
      <SectionLabel>Уведомления</SectionLabel>
      <p className="mt-2 text-tiny text-muted-foreground">
        Что можно присылать. Навязчивые напоминания не шлём сверх этих флагов.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Toggle
          label={role === "trainer" ? "Сообщать клиенту об отмене" : "Получать подтверждения записи"}
          on={prefs.notifyClient}
          onClick={() => setNotifyPrefs({ notifyClient: !prefs.notifyClient })}
        />
        <Toggle
          label={role === "trainer" ? "Сигналы тренеру" : "Сообщения от тренера"}
          on={prefs.notifyTrainer}
          onClick={() => setNotifyPrefs({ notifyTrainer: !prefs.notifyTrainer })}
        />
        {role === "trainer" ? (
          <Toggle
            label="Помечать поздние отмены"
            on={prefs.flagLate}
            onClick={() => setNotifyPrefs({ flagLate: !prefs.flagLate })}
          />
        ) : null}
      </div>
    </Surface>
  );
}

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex h-11 items-center justify-between rounded-xl px-3 text-left text-sm",
        on ? "bg-primary/15 ring-1 ring-primary/30" : "bg-secondary",
      )}
    >
      <span>{label}</span>
      <span className={cn("text-xs font-medium", on ? "text-primary" : "text-muted-foreground")}>
        {on ? "вкл" : "выкл"}
      </span>
    </button>
  );
}
