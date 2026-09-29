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
