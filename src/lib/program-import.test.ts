import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSessions, findClients, parseImportCommand, programFor, splitDays, type DayText } from "./program-import.ts";

function daysOf(body: string): DayText[] {
  const r = splitDays(body);
  if (!r.ok) throw new Error(r.error);
  return r.days;
}

test("command: name on the first line, program below", () => {
  const r = parseImportCommand("/program Иванов\nДень A\nЖим лежа\n4×8");
  assert.deepEqual(r, { ok: true, query: "Иванов", body: "День A\nЖим лежа\n4×8" });
});

test("command: alias and bot suffix; other messages are not commands", () => {
  assert.equal(parseImportCommand("/программа@ruksha_discipline_bot Иван\nЖим\n3×5")?.ok, true);
  assert.equal(parseImportCommand("/programmer Иван\nЖим"), null, "programmer is not /program");
  assert.equal(parseImportCommand("привет"), null);
  assert.equal(parseImportCommand("/start"), null);
});

test("command: missing name or empty body is an error with a hint", () => {
  const noName = parseImportCommand("/program\nЖим лежа\n3×5");
  assert.ok(noName && !noName.ok && /Укажите клиента/.test(noName.error));
  const noBody = parseImportCommand("/program Иванов");
  assert.ok(noBody && !noBody.ok && /пустая/.test(noBody.error));
});

test("days: without headers the whole body is day A; headers split days", () => {
  const one = splitDays("Жим лежа\n3×8");
  assert.ok(one.ok && one.days.length === 1 && one.days[0].name === "День A");
  const two = daysOf("День A — грудь\nЖим\n3×8\n\nДень B\nТяга\n3×10");
  assert.deepEqual(two.map((d) => d.name), ["День A — грудь", "День B"]);
  assert.deepEqual(two[1].lines, ["Тяга", "3×10"]);
});

test("days: a header with no exercises is an error; empty text is an error", () => {
  const hollow = splitDays("День A\nЖим\n3×8\nДень B");
  assert.ok(!hollow.ok && /День B/.test(hollow.error));
  const none = splitDays("   \n\n");
  assert.ok(!none.ok);
});

test("days: more than seven days is refused", () => {
  const body = Array.from({ length: 8 }, (_, i) => `День ${i + 1}\nЖим\n3×8`).join("\n");
  const r = splitDays(body);
  assert.ok(!r.ok && /7/.test(r.error));
});

test("sessions: lines become blocks with sets, load, rest and side; items are the derived lines", () => {
  const days = daysOf("День A\nЖим лежа\n4х8\n80 кг\nОтдых 90 секунд\nПодъём гантелей\n3×12 на каждую руку\n10 кг");
  const { sessions, warnings } = buildSessions(days, 1000);
  assert.equal(sessions.length, 1);
  const [press, raise] = sessions[0].blocks;
  assert.equal(press.exercise, "Жим лежа");
  assert.equal(press.sets, 4);
  assert.equal(press.reps, "8");
  assert.equal(press.load, "80");
  assert.equal(press.rest, 90);
  assert.equal(raise.side, "руку");
  assert.equal(raise.load, "10");
  assert.deepEqual(warnings, []);
  assert.deepEqual(sessions[0].items.slice(0, 4), ["Жим лежа", "4×8", "80 кг", "Отдых 90 секунд"]);
});

test("sessions: block ids are unique across days", () => {
  const days = daysOf("День A\nЖим\n3×8\nДень B\nЖим\n3×8");
  const { sessions } = buildSessions(days, 1000);
  const ids = sessions.flatMap((s) => s.blocks.map((b) => b.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("sessions: a number line with no exercise name is reported", () => {
  const days = daysOf("День A\nЖим\n3×8\n80 кг\n10 кг");
  const { warnings } = buildSessions(days, 1000);
  assert.equal(warnings.length, 1, "the first load line fills the empty load of Жим; the second has nothing to fill and starts a block named \"10 кг\"");
});

const clients = [
  { id: "a", firstName: "Иван", lastName: "Иванов", telegramUsername: "ivanov_ivan" },
  { id: "b", firstName: "Иван", lastName: "Петров", telegramUsername: null },
  { id: "c", firstName: "Мария", lastName: "Иванова", telegramUsername: "@maria" },
];

test("find: full name wins, a single word matches by prefix, several matches stay several", () => {
  assert.deepEqual(findClients(clients, "Иван Петров").map((c) => c.id), ["b"]);
  assert.deepEqual(findClients(clients, "Иванов").map((c) => c.id), ["a", "c"], "two surnames share the prefix: the bot asks");
  assert.deepEqual(findClients(clients, "Иванов Иван").map((c) => c.id), ["a"]);
  assert.deepEqual(findClients(clients, "Иван").map((c) => c.id), ["a", "b", "c"], "Иванова starts with Иван too: the bot asks");
  assert.deepEqual(findClients(clients, "Иван Иванов").map((c) => c.id), ["a"]);
  assert.deepEqual(findClients(clients, "Сергей"), []);
});

test("find: @handle matches with or without the @ in the stored handle", () => {
  assert.deepEqual(findClients(clients, "@ivanov_ivan").map((c) => c.id), ["a"]);
  assert.deepEqual(findClients(clients, "@maria").map((c) => c.id), ["c"]);
});

test("stamp: an older trainer copy does not overwrite a program imported later", () => {
  const old = { sessions: ["imported"], programAt: "2026-10-10T10:00:00.000Z" };
  const stale = { sessions: ["stale"], programAt: null };
  assert.deepEqual(programFor(old, stale), { sessions: ["imported"], programAt: "2026-10-10T10:00:00.000Z" });
  const older = { sessions: ["stale"], programAt: "2026-10-09T10:00:00.000Z" };
  assert.deepEqual(programFor(old, older).sessions, ["imported"]);
});

test("stamp: a copy read after the import passes, and so does a client with no stamp yet", () => {
  const old = { sessions: ["imported"], programAt: "2026-10-10T10:00:00.000Z" };
  const fresh = { sessions: ["edited"], programAt: "2026-10-10T10:00:00.000Z" };
  assert.deepEqual(programFor(old, fresh).sessions, ["edited"]);
  assert.deepEqual(programFor({ sessions: ["x"] }, { sessions: ["y"] }).sessions, ["y"]);
  assert.deepEqual(programFor(undefined, { sessions: ["new"] }), { sessions: ["new"], programAt: null });
});
