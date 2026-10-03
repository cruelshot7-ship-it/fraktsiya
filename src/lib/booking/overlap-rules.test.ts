import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientBookingsConflict, rangesOverlap, trainerSlotsConflict } from "./overlap-rules.ts";

describe("rangesOverlap", () => {
  it("detects overlap on same day", () => {
    assert.equal(
      rangesOverlap(
        { date: "2026-10-01", time: "19:00", durationMin: 60 },
        { date: "2026-10-01", time: "19:30", durationMin: 60 },
      ),
      true,
    );
  });

  it("allows back-to-back", () => {
    assert.equal(
      rangesOverlap(
        { date: "2026-10-01", time: "19:00", durationMin: 60 },
        { date: "2026-10-01", time: "20:00", durationMin: 60 },
      ),
      false,
    );
  });

  it("ignores different days", () => {
    assert.equal(
      rangesOverlap(
        { date: "2026-10-01", time: "19:00", durationMin: 60 },
        { date: "2026-10-02", time: "19:00", durationMin: 60 },
      ),
      false,
    );
  });
});

describe("trainerSlotsConflict / clientBookingsConflict", () => {
  it("blocks trainer double-book of own time", () => {
    const existing = [{ date: "2026-10-01", time: "10:00", durationMin: 90 }];
    assert.equal(
      trainerSlotsConflict(existing, { date: "2026-10-01", time: "11:00", durationMin: 60 }),
      true,
    );
  });

  it("blocks client overlapping bookings", () => {
    const existing = [{ date: "2026-10-01", time: "18:00", durationMin: 60 }];
    assert.equal(
      clientBookingsConflict(existing, { date: "2026-10-01", time: "18:30", durationMin: 60 }),
      true,
    );
  });
});
