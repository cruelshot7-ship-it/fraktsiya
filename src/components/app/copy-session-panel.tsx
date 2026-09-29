import { useState } from "react";
import { activeClient, useStudio } from "@/lib/studio-store";
import { appendCopiedSession } from "@/lib/templates/copy-session";
import { SectionLabel, Surface } from "@/components/app/bits";

/** Trainer: duplicate a program day onto the client's plan. */
export function CopySessionPanel() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const updateClient = useStudio((s) => s.updateClient);
  const showToast = useStudio((s) => s.showToast);
  const client = activeClient({ clients, activeClientId });
  const [sourceId, setSourceId] = useState("");

  if (role !== "trainer" || !client || !client.sessions.length) return null;

  function apply() {
    const id = sourceId || client!.sessions[client!.sessions.length - 1]?.id;
    if (!id) return;
    const next = appendCopiedSession(client!.sessions, id);
    if (!next) {
      showToast("День не найден.");
      return;
    }
    updateClient(client!.id, { sessions: next });
    showToast("День скопирован в план клиента.");
  }

  return (
    <Surface>
      <SectionLabel>Копия дня программы</SectionLabel>
      <p className="mt-2 text-tiny text-muted-foreground">
        Независимая копия дня. Правки шаблона позже не затронут этот день.
      </p>
      <select
        className="mt-3 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
        value={sourceId || client.sessions[client.sessions.length - 1]?.id || ""}
        onChange={(e) => setSourceId(e.target.value)}
      >
        {client.sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="pressable mt-2 h-11 w-full rounded-xl bg-secondary text-sm font-medium"
        onClick={apply}
      >
        Скопировать день в план
      </button>
    </Surface>
  );
}
