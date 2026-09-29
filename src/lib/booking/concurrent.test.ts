/**
 * Capacity race: only one active booking may occupy the last seat.
 * Pure in-memory simulation of the same rules as bookSlotTransactional
 * (advisory lock + count active + unique(slot, client)).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

type Booking = { id: string; slotId: string; clientId: string; status: string };

function makeBooker(capacity: number) {
  const bookings: Booking[] = [];
  let lock: Promise<void> = Promise.resolve();

  async function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const prev = lock;
    let release!: () => void;
    lock = new Promise<void>((r) => {
      release = r;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async function tryBook(slotId: string, clientId: string): Promise<"ok" | "full" | "already"> {
    return withLock(() => {
      const active = bookings.filter(
        (b) => b.slotId === slotId && ["held", "confirmed", "attended"].includes(b.status),
      );
      if (active.some((b) => b.clientId === clientId)) return "already";
      if (active.length >= capacity) return "full";
      bookings.push({
        id: `bk_${slotId}_${clientId}`,
        slotId,
        clientId,
        status: "held",
      });
      return "ok";
    });
  }

  async function recordResult(bookingId: string): Promise<"created" | "exists" | "missing"> {
    return withLock(() => {
      const b = bookings.find((x) => x.id === bookingId);
      if (!b) return "missing";
      if (b.status === "attended") return "exists";
      b.status = "attended";
      return "created";
    });
  }

  return { tryBook, recordResult, bookings };
}

describe("concurrent last-seat booking (rule simulation)", () => {
  it("allows only one winner for capacity=1 under parallel attempts", async () => {
    const booker = makeBooker(1);
    const results = await Promise.all([
      booker.tryBook("slot_last", "client_a"),
      booker.tryBook("slot_last", "client_b"),
      booker.tryBook("slot_last", "client_c"),
    ]);
    const oks = results.filter((r) => r === "ok");
    assert.equal(oks.length, 1, `expected one ok, got ${JSON.stringify(results)}`);
    const held = booker.bookings.filter((b) => b.status === "held");
    assert.equal(held.length, 1);
  });

  it("rejects second result for the same booking (idempotent)", async () => {
    const booker = makeBooker(2);
    assert.equal(await booker.tryBook("s1", "c1"), "ok");
    const id = "bk_s1_c1";
    assert.equal(await booker.recordResult(id), "created");
    assert.equal(await booker.recordResult(id), "exists");
    assert.equal(booker.bookings.filter((b) => b.id === id && b.status === "attended").length, 1);
  });

  it("same client cannot double-book the same slot", async () => {
    const booker = makeBooker(3);
    assert.equal(await booker.tryBook("s2", "c1"), "ok");
    assert.equal(await booker.tryBook("s2", "c1"), "already");
  });
});
