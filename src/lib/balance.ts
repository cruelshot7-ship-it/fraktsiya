/**
 * Server-side settlement of session balances. Pure, no I/O.
 *
 * Model: every balance change is a ledger event with a stable id.
 *  - hold   (booking made, -1)      admitted only if the server still has a session and
 *                                   the booking carries that hold's id
 *  - cancel (booking removed)       id is `cancel:<holdId>`; the server decides refund (+1)
 *                                   or late burn (0, lateCancels+1) from its own clock
 *  - credit / adjust                trainer only, applied once
 * Each event id is applied at most once (`txnIds`), so a stale copy of a client or a
 * trainer that re-sends old events cannot double-charge, double-refund or resurrect a
 * cancelled booking. The sender's `sessionsLeft` is ignored; the server recomputes it.
 */
import type { Booking, Client, SessionTxn } from "@/data/studio";
import { isLateCancelAt } from "./minsk-time.ts";

export const LEDGER_KEEP = 40;
export const TXN_ID_KEEP = 300;

export type BalanceActor = "client" | "trainer";
export type LateRule = { flagLate: boolean; windowHours: number };
export type Snapshot = { clients: Client[]; bookings: Booking[] };
export type Balance = { sessionsLeft: number; ledger: SessionTxn[]; lateCancels: number; txnIds: string[] };
export type SettleResult = {
  /** settled balance per owned client id */
  balances: Map<string, Balance>;
  /** full booking list: owned rows settled, other rows untouched */
  bookings: Booking[];
  /** event ids the server refused (kept in txnIds so they are never retried) */
  rejected: string[];
};

/** A cancellation names the hold it undoes, so rebooking the same slot gets its own cancel. */
export function cancelTxnId(booking: Pick<Booking, "id" | "holdId">) {
  return `cancel:${booking.holdId ?? booking.id}`;
}

export function settleOwned(
  current: Snapshot,
  incoming: Snapshot,
  owners: Set<string>,
  actor: BalanceActor,
  rule: LateRule,
  now: number,
  mergeRow: (prev: Booking, row: Booking) => Booking = (prev, row) => ({ ...prev, ...row }),
): SettleResult {
  const curClients = new Map(current.clients.map((c) => [c.id, c]));
  const incClients = new Map(incoming.clients.map((c) => [c.id, c]));
  const balances = new Map<string, Balance>();
  const rejected: string[] = [];
  const ownerRows = new Map<string, Booking[]>();
  const at = new Date(now).toISOString();

  for (const id of owners) {
    const prev = curClients.get(id);
    const inc = incClients.get(id);
    if (!inc && !prev) continue;
    if (!prev && actor === "client") continue;

    const ownPrev = current.bookings.filter((b) => b.clientId === id);
    const incRows = new Map(incoming.bookings.filter((b) => b.clientId === id).map((b) => [b.id, b]));
    const live = new Map(ownPrev.map((b) => [b.id, b]));
    const admitted = new Map<string, Booking>();
    // Entries already in the stored ledger were applied before txnIds existed: never replay them.
    const seen = new Set([...(prev?.ledger ?? []).map((t) => t.id), ...(prev?.txnIds ?? [])]);
    let balance = prev?.sessionsLeft ?? 0;
    let lateCancels = prev?.lateCancels ?? 0;
    const applied: SessionTxn[] = [];

    // Incoming ledgers are newest-first; settle oldest-first.
    const queue: SessionTxn[] = [...(inc?.ledger ?? [])].reverse();
    if (!prev && actor === "trainer" && queue.length === 0 && (inc?.sessionsLeft ?? 0) > 0) {
      queue.push({ id: `init_${id}`, clientId: id, kind: "credit", delta: inc!.sessionsLeft, at, note: "Стартовый баланс" });
    }

    for (const t of queue) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);

      if (t.kind === "hold") {
        const row = t.bookingId ? incRows.get(t.bookingId) : undefined;
        if (!row || live.has(row.id) || row.holdId !== t.id || balance < 1) {
          rejected.push(t.id);
          continue;
        }
        balance -= 1;
        live.set(row.id, row);
        admitted.set(row.id, row);
        applied.push({ ...t, delta: -1 });
        continue;
      }

      if ((t.kind === "refund" || t.kind === "burn") && t.bookingId) {
        const b = live.get(t.bookingId);
        if (!b || t.id !== cancelTxnId(b)) {
          rejected.push(t.id);
          continue;
        }
        // A rescheduled booking is judged by its current slot, not the one it was first booked for.
        const cur = incRows.get(b.id) ?? b;
        const late = actor === "client" && rule.flagLate && isLateCancelAt(cur.date, cur.time, now, rule.windowHours);
        live.delete(b.id);
        if (late) {
          lateCancels += 1;
          applied.push({ ...t, kind: "burn", delta: 0, at });
        } else {
          balance += 1;
          applied.push({ ...t, kind: "refund", delta: 1, at });
        }
        continue;
      }

      if (actor === "trainer" && (t.kind === "credit" || t.kind === "adjust") && !t.bookingId) {
        balance = Math.max(0, balance + t.delta);
        applied.push({ ...t, at: t.at || at });
        continue;
      }

      rejected.push(t.id);
    }

    const ledger = [...applied].reverse().concat(prev?.ledger ?? []).slice(0, LEDGER_KEEP);
    balances.set(id, {
      sessionsLeft: balance,
      ledger,
      lateCancels,
      txnIds: [...seen].slice(-TXN_ID_KEEP),
    });

    const rows: Booking[] = [];
    for (const b of ownPrev) {
      if (!live.has(b.id)) continue;
      const row = incRows.get(b.id);
      rows.push(row ? mergeRow(b, row) : b);
    }
    for (const [bid, b] of admitted) if (live.has(bid)) rows.push(b);
    ownerRows.set(id, rows);
  }

  const kept = current.bookings.filter((b) => !owners.has(b.clientId));
  const bookings = [...kept, ...[...ownerRows.values()].flat()];
  return { balances, bookings, rejected };
}
