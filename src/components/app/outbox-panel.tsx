import { useEffect, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { flushLocal, loadOutbox, outboxPending } from "@/lib/notify/local-outbox-store";
import type { OutboxEvent } from "@/lib/notify/outbox";
import { SectionLabel, Surface } from "@/components/app/bits";

export function OutboxPanel() {
  const role = useStudio((s) => s.role);
  const showToast = useStudio((s) => s.showToast);
  const [items, setItems] = useState<OutboxEvent[]>([]);
  const [pending, setPending] = useState(0);

  function refresh() {
    setItems(loadOutbox().slice(-12).reverse());
    setPending(outboxPending());
  }

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 8000);
    return () => window.clearInterval(t);
  }, []);

  if (role !== "trainer") return null;

  return (
    <Surface>
      <SectionLabel>Очередь уведомлений</SectionLabel>
      <p className="mt-2 text-tiny text-muted-foreground">
        Событие пишется сразу. Отправка ботом — best-effort (локальная очередь). Pending:{" "}
        {pending}
      </p>
      <button
        type="button"
        className="pressable mt-3 h-10 w-full rounded-xl bg-secondary text-sm"
        onClick={() => {
          void flushLocal(true).then(() => {
            refresh();
            showToast("Очередь обработана (симуляция доставки).");
          });
        }}
      >
        Прогнать очередь
      </button>
      {items.length ? (
        <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-2xs text-muted-foreground">
          {items.map((e) => (
            <li key={e.id} className="truncate">
              [{e.status}] {e.kind} · tg {e.telegramId}
              {e.lastError ? ` · ${e.lastError}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-tiny text-muted-foreground">Очередь пуста.</p>
      )}
    </Surface>
  );
}
