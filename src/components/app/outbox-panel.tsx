import { useEffect, useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { flushLocal, loadOutbox, outboxPending } from "@/lib/notify/local-outbox-store";
import type { OutboxEvent } from "@/lib/notify/outbox";
import { SectionLabel, Surface } from "@/components/app/bits";

const BUILD = "stage2 · 29.09.2026";

export function OutboxPanel() {
  const role = useStudio((s) => s.role);
  const showToast = useStudio((s) => s.showToast);
  const [items, setItems] = useState<OutboxEvent[]>([]);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);

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

  async function runFlush() {
    if (busy) return;
    setBusy(true);
    try {
      const pendingItems = loadOutbox().filter((e) => e.status === "pending").slice(0, 20);
      if (!pendingItems.length) {
        await flushLocal(true);
        refresh();
        showToast("Очередь пуста.");
        return;
      }
      try {
        const { flushOutboxServerFn } = await import("@/lib/notify/flush-server");
        const res = await flushOutboxServerFn({
          data: {
            events: pendingItems.map((e) => ({
              id: e.id,
              kind: e.kind,
              telegramId: e.telegramId,
              payload: e.payload as Record<string, unknown> | undefined,
            })),
          },
        });
        await flushLocal(true);
        const okN = res.results.filter((r) => r.ok).length;
        const failN = res.results.length - okN;
        showToast(
          failN
            ? `Бот: ок ${okN}, ошибок ${failN} (проверьте BOT_TOKEN).`
            : `Бот: отправлено ${okN}.`,
        );
      } catch {
        await flushLocal(true);
        showToast("Локальная очередь обработана (сервер бота недоступен).");
      }
      refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface>
      <SectionLabel>Очередь уведомлений</SectionLabel>
      <p className="mt-1 text-2xs text-muted-foreground">сборка {BUILD}</p>
      <p className="mt-2 text-tiny text-muted-foreground">
        Событие пишется сразу. «Прогнать» шлёт через бота, если задан BOT_TOKEN. Pending: {pending}
      </p>
      <button
        type="button"
        disabled={busy}
        className="pressable mt-3 h-10 w-full rounded-xl bg-secondary text-sm disabled:opacity-50"
        onClick={() => void runFlush()}
      >
        {busy ? "Отправка…" : "Прогнать очередь (бот)"}
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
