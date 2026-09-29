/**
 * Notification outbox: event is durable first; bot delivery is best-effort.
 */

export type OutboxStatus = "pending" | "sent" | "failed";

export type OutboxEvent = {
  id: string;
  kind: "booking_confirmed" | "booking_cancelled" | "attendance" | "progression_decided" | "generic";
  telegramId: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  createdAt: string;
  lastError?: string;
};

export type DeliverFn = (event: OutboxEvent) => Promise<{ ok: boolean; error?: string }>;

const MAX_ATTEMPTS = 5;

export function enqueueEvent(
  list: OutboxEvent[],
  input: Omit<OutboxEvent, "status" | "attempts" | "createdAt"> & { createdAt?: string },
): OutboxEvent[] {
  const ev: OutboxEvent = {
    ...input,
    status: "pending",
    attempts: 0,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  return [...list, ev];
}

export async function flushOutbox(
  list: OutboxEvent[],
  deliver: DeliverFn,
): Promise<OutboxEvent[]> {
  const next = [...list];
  for (let i = 0; i < next.length; i++) {
    const ev = next[i];
    if (ev.status !== "pending") continue;
    if (ev.attempts >= MAX_ATTEMPTS) {
      next[i] = { ...ev, status: "failed", lastError: ev.lastError ?? "max_attempts" };
      continue;
    }
    try {
      const res = await deliver(ev);
      if (res.ok) {
        next[i] = { ...ev, status: "sent", attempts: ev.attempts + 1, lastError: undefined };
      } else {
        const attempts = ev.attempts + 1;
        next[i] = {
          ...ev,
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          lastError: res.error ?? "deliver_failed",
        };
      }
    } catch (e) {
      const attempts = ev.attempts + 1;
      next[i] = {
        ...ev,
        attempts,
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        lastError: e instanceof Error ? e.message : String(e),
      };
    }
  }
  return next;
}

export function pendingCount(list: OutboxEvent[]): number {
  return list.filter((e) => e.status === "pending").length;
}
