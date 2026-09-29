import { clientActionItems, trainerActionItems, type ActionItem } from "@/lib/action-items";
import { activeClient, useStudio } from "@/lib/studio-store";
import { EmptyHint, SectionLabel, Surface } from "@/components/app/bits";
import { cn } from "@/lib/utils";

/**
 * Situational home: tasks that lead straight to the right screen.
 * Not a vanity dashboard.
 */
export function ActionCenter() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const slots = useStudio((s) => s.slots);
  const notices = useStudio((s) => s.notices);
  const joinRequests = useStudio((s) => s.joinRequests);
  const setTab = useStudio((s) => s.setTab);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const client = activeClient({ clients, activeClientId });

  const items: ActionItem[] =
    role === "trainer"
      ? trainerActionItems({
          clients,
          bookings,
          slots,
          notices,
          joinPendingCount: joinRequests.filter((r) => r.status === "pending").length,
        })
      : client
        ? clientActionItems({ client, bookings, slots, notices })
        : [];

  function open(item: ActionItem) {
    if (item.clientId && role === "trainer" && item.tab === "clients") {
      openClientSheet(item.clientId);
    }
    setTab(item.tab);
  }

  if (!items.length) {
    return (
      <EmptyHint>
        {role === "trainer"
          ? "На сегодня задач нет. Откройте слоты или клиентов."
          : "Когда появится запись или план — здесь будут следующие шаги."}
      </EmptyHint>
    );
  }

  return (
    <div className="stagger-in flex flex-col gap-2">
      <SectionLabel>Центр действий</SectionLabel>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => open(item)} className="pressable text-left">
          <Surface
            className={cn(
              item.priority <= 12 && "shadow-glow-alert",
              item.kind === "next_session" && "glow-ok",
            )}
          >
            <p className="text-sm font-medium leading-snug">{item.title}</p>
            <p className="mt-1 text-tiny text-muted-foreground">{item.body}</p>
          </Surface>
        </button>
      ))}
    </div>
  );
}
