import { enqueueLocal } from "@/lib/notify/local-outbox-store";

export function enqueueBookingConfirmed(opts: {
  telegramId?: string | null;
  bookingId: string;
  clientId: string;
  date: string;
  time: string;
}) {
  const tg = (opts.telegramId || "").trim();
  if (!tg) return;
  enqueueLocal({
    id: `out_book_${opts.bookingId}`,
    kind: "booking_confirmed",
    telegramId: tg,
    payload: {
      bookingId: opts.bookingId,
      clientId: opts.clientId,
      date: opts.date,
      time: opts.time,
    },
  });
}

export function enqueueBookingCancelled(opts: {
  telegramId?: string | null;
  bookingId: string;
  clientId: string;
}) {
  const tg = (opts.telegramId || "").trim();
  if (!tg) return;
  enqueueLocal({
    id: `out_cancel_${opts.bookingId}_${Date.now()}`,
    kind: "booking_cancelled",
    telegramId: tg,
    payload: { bookingId: opts.bookingId, clientId: opts.clientId },
  });
}

/** Best-effort: ask server to deliver pending outbox (no throw). */
export function tryFlushPending() {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const { loadOutbox, flushLocal } = await import("@/lib/notify/local-outbox-store");
      const pending = loadOutbox().filter((e) => e.status === "pending").slice(0, 10);
      if (!pending.length) return;
      const { flushOutboxServerFn } = await import("@/lib/notify/flush-server");
      await flushOutboxServerFn({
        data: {
          events: pending.map((e) => ({
            id: e.id,
            kind: e.kind,
            telegramId: e.telegramId,
            payload: e.payload as Record<string, unknown> | undefined,
          })),
        },
      });
      await flushLocal(true);
    } catch {
      /* offline / no token */
    }
  })();
}
