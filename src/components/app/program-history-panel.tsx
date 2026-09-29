import { relativeLabel } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { historyForClient, type ProgramHistoryEntry } from "@/lib/program-history";
import { SectionLabel, Surface } from "@/components/app/bits";

export function ProgramHistoryPanel() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const notices = useStudio((s) => s.notices);
  const client = activeClient({ clients, activeClientId });
  if (!client) return null;

  const fromNotices: ProgramHistoryEntry[] = notices
    .filter(
      (n) =>
        n.clientId === client.id &&
        (n.title.toLowerCase().includes("програм") ||
          n.title.toLowerCase().includes("план") ||
          n.title.toLowerCase().includes("шаблон") ||
          n.title.toLowerCase().includes("нагрузк") ||
          n.title.toLowerCase().includes("прогресс") ||
          n.title.toLowerCase().includes("решени") ||
          n.kind === "reschedule" ||
          n.kind === "progression"),
    )
    .map((n) => ({
      id: n.id,
      clientId: client.id,
      at: n.at,
      kind: "note" as const,
      title: n.title,
      body: n.body,
    }));

  const items = historyForClient(fromNotices, client.id).slice(0, 8);
  if (!items.length) return null;

  return (
    <Surface>
      <SectionLabel>История изменений плана</SectionLabel>
      <ul className="mt-3 space-y-2">
        {items.map((e) => (
          <li key={e.id} className="rounded-lg bg-secondary/40 px-3 py-2">
            <p className="text-sm font-medium">{e.title}</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">{e.body}</p>
            <p className="mt-1 text-2xs text-muted-foreground">{relativeLabel(e.at)}</p>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
