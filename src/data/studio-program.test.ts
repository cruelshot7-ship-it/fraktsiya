import assert from "node:assert/strict";
import test from "node:test";
import { clientStreak, dayRitual, motiveFor, nextTrainDate, type Booking, type Client, type MotiveCtx } from "./studio.ts";

// 2026-10-15 — четверг. Тренировки клиента: ПН, СР, ПТ (dow 0, 2, 4).
const client = { id: "c1", trainDays: [0, 2, 4], trainTimes: [] } as unknown as Client;
const book = (date: string, checkedIn = false) =>
  ({ id: `b_${date}`, clientId: "c1", date, time: "10:00", checkedIn }) as unknown as Booking;

const base: Omit<MotiveCtx, "viewer"> = {
  client,
  today: "2026-10-15",
  trainDay: true,
  checkedIn: false,
  hoursToSession: null,
  foodCount: 0,
  workout: null,
  checks: 0,
  totalItems: 4,
  frozen: false,
  streak: 0,
};

const SECOND_PERSON = /\b(ты|тебе|тебя|тобой|вы|вас|вам|вами|собери|торгуйся|не договаривайся)\b/i;

test("trainer copy never addresses the trainer as 'you'", () => {
  const cases: Partial<MotiveCtx>[] = [
    {},
    { frozen: true },
    { checkedIn: true },
    { checks: 2 },
    { hoursToSession: 0.5 },
    { hoursToSession: 2 },
    { trainDay: false },
    { foodCount: 1, trainDay: true, checkedIn: true, checks: 4 },
    { streak: 5 },
    { workout: { kcal: 300 } as never },
  ];
  for (const c of cases) {
    const line = motiveFor({ ...base, ...c, viewer: "trainer" });
    assert.doesNotMatch(`${line.kicker} ${line.line}`, SECOND_PERSON, JSON.stringify(c));
  }
});

test("client copy keeps the 'you' tone", () => {
  assert.match(motiveFor({ ...base, hoursToSession: 2, viewer: "client" }).line, /Собери форму/);
});

test("slot countdown reads in minutes when it is close", () => {
  const line = motiveFor({ ...base, checkedIn: false, hoursToSession: 0.5, viewer: "trainer" });
  assert.equal(line.kicker, "Скоро слот");
  assert.equal(line.line, "Слот через 30 мин. Явка пока не отмечена.");
});

test("day ritual: arrival is the visit tile, a rest day starts with it lit", () => {
  assert.deepEqual(
    dayRitual({ trainDay: true, arrived: false, workout: false, foodCount: 0 }),
    { visit: false, workout: false, food: false, restDay: false, done: 0 },
  );
  // еда без визита не закрывает визит
  assert.equal(dayRitual({ trainDay: true, arrived: false, workout: false, foodCount: 2 }).visit, false);
  assert.equal(dayRitual({ trainDay: true, arrived: true, workout: false, foodCount: 2 }).done, 2);
  assert.equal(dayRitual({ trainDay: false, arrived: false, workout: false, foodCount: 0 }).done, 1);
});

test("streak uses visits on training days and ignores food entries", () => {
  const visits = [{ clientId: "c1", date: "2026-10-12" }, { clientId: "c1", date: "2026-10-14" }] as never[];
  assert.equal(clientStreak(client, [], visits, "2026-10-15"), 2);
  // без визитов серия 0, сколько бы еды ни было записано
  assert.equal(clientStreak(client, [], [], "2026-10-15"), 0);
});

test("streak counts a booked visit once it is checked in", () => {
  const bookings = [book("2026-10-12", true), book("2026-10-14", true)];
  assert.equal(clientStreak(client, bookings, [], "2026-10-15"), 2);
  // запись без прихода серию не двигает
  assert.equal(clientStreak(client, [book("2026-10-14")], [], "2026-10-15"), 0);
});

test("next training date comes from the schedule or a booking, and is null when there is none", () => {
  assert.equal(nextTrainDate(client, [], "2026-10-15"), "2026-10-16");
  // запись на четверг, которой нет в расписании, тоже считается визитом
  assert.equal(nextTrainDate(client, [book("2026-10-15")], "2026-10-15"), "2026-10-15");
  const none = { id: "c2", trainDays: [] } as unknown as Client;
  assert.equal(nextTrainDate(none, [], "2026-10-15"), null);
});
