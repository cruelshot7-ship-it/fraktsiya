import { useStudio, activeClient } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";

/**
 * Client sees trainer decisions about the program (accept / keep / manual).
 * Not medical advice — just what the trainer decided.
 */
export function DecisionBanner() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const notices = useStudio((s) => s.notices);
  const dismissed = useStudio((s) => s.dismissedSignalIds);
  const dismissSignal = useStudio((s) => s.dismissSignal);
  const setTab = useStudio((s) => s.setTab);
  const me = activeClient({ clients, activeClientId });

  if (role !== "client" || !me) return null;

  const items = notices
    .filter(
      (n) =>
        n.audience === "client" &&
        n.clientId === me.id &&
        !dismissed.includes(n.id) &&
        (n.kind === "book" ||
          n.kind === "reschedule" ||
          n.kind === "progression" ||
          n.title.toLowerCase().includes("програм") ||
          n.title.toLowerCase().includes("прогресс") ||
          n.title.toLowerCase().includes("план") ||
          n.title.toLowerCase().includes("нагрузк") ||
          n.title.toLowerCase().includes("решени")),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);

  if (!items.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Решение тренера</SectionLabel>
      {items.map((n) => (
        <Surface key={n.id} glow="soft">
          <p className="text-sm font-medium">{n.title}</p>
          <p className="mt-1 text-tiny text-muted-foreground">{n.body}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="pressable rounded-lg bg-secondary px-3 py-1.5 text-xs"
              onClick={() => setTab("program")}
            >
              К плану
            </button>
            <button
              type="button"
              className="pressable rounded-lg px-3 py-1.5 text-xs text-muted-foreground"
              onClick={() => dismissSignal(n.id)}
            >
              Скрыть
            </button>
          </div>
        </Surface>
      ))}
    </div>
  );
}
