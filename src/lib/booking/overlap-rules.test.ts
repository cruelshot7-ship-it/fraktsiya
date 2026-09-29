import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  clientBookingsConflict,
  rangesOverlap,
  trainerSlotsConflict,
  hasUpcomingBookings,
} from "./overlap-rules.ts";

describe("rangesOverlap", () => {
  it("detects overlap on same day", () => {
    assert.equal(
      rangesOverlap(
        { date: "2026-09-30", time: "10:00", durationMin: 60 },
        { date: "2026-09-30", time: "10:30", durationMin: 60 },
      ),
      true,
    );
  });
  it("allows back-to-back", () => {
    assert.equal(
      rangesOverlap(
        { date: "2026-09-30", time: "10:00", durationMin: 60 },
        { date: "2026-09-30", time: "11:00", durationMin: 60 },
      ),
      false,
    );
  });
  it("ignores different days", () => {
    assert.equal(
      rangesOverlap(
        { date: "2026-09-30", time: "10:00", durationMin: 60 },
        { date: "2026-10-01", time: "10:00", durationMin: 60 },
      ),
      false,
    );
  });
});

describe("trainerSlotsConflict / clientBookingsConflict", () => {
  it("blocks trainer double-book of own time", () => {
    assert.equal(
      trainerSlotsConflict(
        [{ date: "2026-09-30", time: "19:00", durationMin: 60 }],
        { date: "2026-09-30", time: "19:00", durationMin: 60 },
      ),
      true,
    );
  });
  it("blocks client overlapping bookings", () => {
    assert.equal(
      clientBookingsConflict(
        [{ date: "2026-09-30", time: "09:00", durationMin: 90 }],
        { date: "2026-09-30", time: "10:00", durationMin: 60 },
      ),
      true,
    );
  });
});

describe("hasUpcomingBookings", () => {
  it("counts only future active", () => {
    const n = hasUpcomingBookings(
      [
        { slotId: "s1", date: "2099-01-01", time: "10:00" },
        { slotId: "s1", date: "2020-01-01", time: "10:00" },
        { slotId: "s1", date: "2099-01-01", time: "11:00", noShow: true },
        { slotId: "s2", date: "2099-01-01", time: "10:00" },
      ],
      "s1",
      (d) => d.startsWith("2020"),
    );
    assert.equal(n, 1);
  });
});
