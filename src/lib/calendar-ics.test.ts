import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildIcs } from "./calendar-ics.ts";

describe("buildIcs", () => {
  it("emits VEVENT with UTC stamps for Minsk wall time", () => {
    const ics = buildIcs({
      id: "bk_1",
      title: "Тренировка Ruksha",
      date: "2026-09-30",
      time: "19:00",
      durationMin: 60,
      timezone: "Europe/Minsk",
      location: "Минск",
    });
    assert.match(ics, /BEGIN:VCALENDAR/);
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /SUMMARY:Тренировка Ruksha/);
    assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
    assert.match(ics, /DTEND:\d{8}T\d{6}Z/);
    assert.match(ics, /LOCATION:Минск/);
    assert.match(ics, /END:VCALENDAR/);
  });
});
