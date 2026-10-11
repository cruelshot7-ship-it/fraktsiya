import {
  applyDeliveryResults,
  enqueueEvent,
  pendingCount,
  type OutboxEvent,
} from "@/lib/notify/outbox";

const KEY = "fraktsiya_notify_outbox_v1";

function read(): OutboxEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: OutboxEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-100)));
  } catch {
    /* quota */
  }
}

export function loadOutbox(): OutboxEvent[] {
  return read();
}

export function enqueueLocal(
  input: Omit<OutboxEvent, "status" | "attempts" | "createdAt"> & { createdAt?: string },
): OutboxEvent[] {
  const next = enqueueEvent(read(), input);
  write(next);
  return next;
}

/** Применить ответ сервера. Без ответа событие остаётся в очереди. Поддельного «ок» больше нет. */
export function applyLocalResults(results: { id: string; ok: boolean; error?: string }[]): OutboxEvent[] {
  const next = applyDeliveryResults(read(), results);
  write(next);
  return next;
}

export function outboxPending(): number {
  return pendingCount(read());
}
