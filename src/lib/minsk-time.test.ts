import assert from "node:assert/strict";
import test from "node:test";
import { studioToday } from "./minsk-time.ts";

test("сегодня по Минску: ночью по Гродно дата уже следующая, даже если в UTC ещё вчера", () => {
  // 22:30 UTC 11 окт = 01:30 по Минску 12 окт
  assert.equal(studioToday(new Date("2026-10-11T22:30:00Z")), "2026-10-12");
});

test("днём дата одна и та же в любом поясе устройства", () => {
  assert.equal(studioToday(new Date("2026-10-11T09:00:00Z")), "2026-10-11");
});

test("граница суток: 20:59 UTC — ещё 23:59 по Минску того же дня", () => {
  assert.equal(studioToday(new Date("2026-10-11T20:59:00Z")), "2026-10-11");
  assert.equal(studioToday(new Date("2026-10-11T21:00:00Z")), "2026-10-12");
});
