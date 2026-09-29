import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { suggestNextSlot } from "./next-slot.ts";
import type { Booking, Slot } from "@/data/studio";

function slot(id: string, date: string, time: string, capacity = 2, seeded = 0): Slot {
  return { id, date, time, duration: 60, capacity, seeded };
}

describe("suggestNextSlot", () => {
  it("returns earliest open future slot", () => {
    const slots = [
      slot("2026-09-29_19:00", "2026-09-29", "19:00"),
      slot("2026-09-30_19:00", "2026-09-30", "19:00"),
      slot("2026-10-01_07:00", "2026-10-01", "07:00"),
    ];
    const out = suggestNextSlot({
      slots,
      bookings: [],
      clientId: "c1",
      afterDate: "2026-09-29",
      afterTime: "19:00",
    });
    assert.ok(out);
    assert.equal(out!.slot.date, "2026-09-30");
  });

  it("skips full slots", () => {
    const slots = [
      slot("2026-09-30_19:00", "2026-09-30", "19:00", 1, 1),
      slot("2026-10-01_07:00", "2026-10-01", "07:00", 1, 0),
    ];
    const out = suggestNextSlot({
      slots,
      bookings: [],
      clientId: "c1",
      afterDate: "2026-09-29",
      afterTime: "10:00",
    });
    assert.ok(out);
    assert.equal(out!.slot.date, "2026-10-01");
  });

  it("skips already booked by client", () => {
    const slots = [
      slot("2026-09-30_19:00", "2026-09-30", "19:00"),
      slot("2026-10-01_07:00", "2026-10-01", "07:00"),
    ];
    const bookings: Booking[] = [
      {
        id: "b1",
        slotId: "2026-09-30_19:00",
        clientId: "c1",
        date: "2026-09-30",
        time: "19:00",
        duration: 60,
      },
    ];
    const out = suggestNextSlot({
      slots,
      bookings,
      clientId: "c1",
      afterDate: "2026-09-29",
      afterTime: "10:00",
    });
    assert.ok(out);
    assert.equal(out!.slot.id, "2026-10-01_07:00");
  });
});
