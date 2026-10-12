import assert from "node:assert/strict";
import test from "node:test";
import { emptyClient } from "../data/studio.ts";
import { morningSummary, trainerNoticeLines } from "./studio-digest.ts";

test("morning summary lists today, empty balance, missed food and a quiet client", () => {
  const anna = { ...emptyClient(), id: "a", firstName: "Анна", lastName: "Иванова", coachId: "1", sessionsLeft: 2 };
  const oleg = { ...emptyClient(), id: "o", firstName: "Олег", lastName: "Петров", coachId: "1", sessionsLeft: 0 };
  const text = morningSummary({
    clients: [anna, oleg, { ...emptyClient(), id: "x", firstName: "Чужой", coachId: "2" }],
    bookings: [
      { id: "b1", slotId: "s", clientId: "a", date: "2026-09-28", time: "19:00", duration: 60 },
      { id: "b2", slotId: "s2", clientId: "o", date: "2026-09-01", time: "18:00", duration: 60, checkedIn: true },
    ],
    visits: [{ id: "v", clientId: "a", date: "2026-09-27", at: "2026-09-27T06:00:00.000Z", waterMl: 250 }],
    food: [],
    today: "2026-09-28",
    absentDays: 10,
    coachId: "1",
  });
  assert.match(text, /Анна И\. · 19:00/);
  assert.match(text, /0 занятий:\n• Олег П\./);
  assert.match(text, /Не сдали еду:\n• Анна И\./);
  assert.match(text, /Нет визита 10\+ дней:\n• Олег П\. · 27 дн\./);
  assert.equal(text.includes("Чужой"), false);
});

test("сводка: уведомления тренера за сутки списком, без данных о самочувствии", () => {
  const now = Date.parse("2026-10-13T06:00:00Z");
  const notice = (over: Record<string, unknown>) =>
    ({ id: "n", audience: "trainer", clientId: "", kind: "alert", title: "Запись", body: "", at: new Date(now - 3600_000).toISOString(), ...over }) as never;
  const text = morningSummary({
    clients: [],
    bookings: [],
    food: [],
    today: "2026-10-13",
    absentDays: 10,
    notices: [
      notice({ title: "Новая запись: Анна И." }),
      notice({ title: "Самочувствие перед тренировкой", body: "сон 5 ч" }),
      notice({ title: "Старое", at: "2026-10-10T10:00:00Z" }),
      notice({ title: "Для клиента", audience: "client" }),
    ],
  });
  assert.match(text, /Уведомления за сутки:/);
  assert.match(text, /Новая запись: Анна И\./);
  assert.doesNotMatch(text, /Самочувствие|сон 5 ч|Старое|Для клиента/);
});

test("сводка: окно — ровно сутки, позапрошлый день не попадает", () => {
  const notice = (at: string, title: string) => ({ id: title, audience: "trainer", clientId: "", kind: "alert", title, body: "", at }) as never;
  const lines = trainerNoticeLines(
    [notice("2026-10-12T21:30:00Z", "внутри окна"), notice("2026-10-11T20:00:00Z", "за окном")],
    "2026-10-13",
  );
  assert.equal(lines.length, 1);
  assert.match(lines[0], /внутри окна/);
});
