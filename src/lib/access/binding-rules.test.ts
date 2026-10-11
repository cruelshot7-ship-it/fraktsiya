import { test } from "node:test";
import assert from "node:assert/strict";
import { TRAINER_TG_ID } from "../../data/studio.ts";
import {
  bindCoachRule,
  canSendBotLinkRule,
  isCoachUserRule,
  normHandle,
  visitsForClients,
} from "./binding-rules.ts";

const TRAINER = String(TRAINER_TG_ID);
const DAY = 24 * 60 * 60 * 1000;
const fresh = new Date(Date.now() - DAY).toISOString(); // trial still running

type P = Parameters<typeof bindCoachRule>[0];
const base = (over: Partial<P> = {}): P =>
  ({ coaches: [], clients: [], visits: [], ...over }) as P;

test("handle normalisation drops @ and case", () => {
  assert.equal(normHandle("@Ivan_Trainer"), "ivan_trainer");
  assert.equal(normHandle(null), "");
});

test("coach row bound by id is never re-pointed to another telegram id", () => {
  const payload = base({
    coaches: [{ telegramId: "111", username: "ivan", firstName: "Иван", lastName: "" , addedAt: fresh }] as P["coaches"],
  });
  // an attacker with the same handle must not take over a row already bound to 111
  const after = bindCoachRule(payload, { id: "999", username: "ivan", firstName: "X", lastName: "" });
  assert.equal(after.coaches?.[0].telegramId, "111");
  assert.equal(after.coaches?.length, 1);
});

test("unbound coach row is claimed by handle only when telegramId is empty", () => {
  const payload = base({
    coaches: [{ telegramId: null, username: "@ivan", firstName: "", lastName: "", addedAt: fresh }] as P["coaches"],
  });
  const after = bindCoachRule(payload, { id: "222", username: "Ivan", firstName: "Иван", lastName: "" });
  assert.equal(after.coaches?.[0].telegramId, "222");
});

test("binding by id fills the name without changing the id", () => {
  const payload = base({
    coaches: [{ telegramId: "333", username: "x", firstName: "", lastName: "", addedAt: fresh }] as P["coaches"],
  });
  const after = bindCoachRule(payload, { id: "333", username: "x", firstName: "Пётр", lastName: "" });
  assert.equal(after.coaches?.[0].telegramId, "333");
  assert.equal(after.coaches?.[0].firstName, "Пётр");
});

test("a coach-row handle does not grant rights once the id is bound elsewhere", () => {
  const payload = base({
    coaches: [{ telegramId: "111", username: "ivan", firstName: "Иван", lastName: "", addedAt: fresh }] as P["coaches"],
  });
  assert.equal(isCoachUserRule(payload, { id: "999", username: "ivan" }), false);
  assert.equal(isCoachUserRule(payload, { id: "111", username: "ivan" }), true);
});

test("paused coach can still open the app but cannot send bot messages", () => {
  const old = new Date(Date.now() - 10 * DAY).toISOString(); // trial over, inside grace = paused
  const client = { id: "c1", telegramId: "500", coachId: "111" };
  const payload = base({
    coaches: [{ telegramId: "111", username: "ivan", firstName: "", lastName: "", addedAt: old }] as P["coaches"],
    clients: [client],
  });
  assert.equal(isCoachUserRule(payload, { id: "111", username: null }), true);
  assert.equal(canSendBotLinkRule(payload, { id: "111", username: null }, "500", Date.now()), false);
});

test("active coach messages only own clients, never arbitrary ids", () => {
  const payload = base({
    coaches: [{ telegramId: "111", username: "ivan", firstName: "", lastName: "", addedAt: fresh }] as P["coaches"],
    clients: [
      { id: "mine", telegramId: "500", coachId: "111" },
      { id: "theirs", telegramId: "600", coachId: "222" },
    ],
  });
  const coach = { id: "111", username: "ivan" };
  assert.equal(canSendBotLinkRule(payload, coach, "500"), true);
  assert.equal(canSendBotLinkRule(payload, coach, "600"), false, "другой тренер — нельзя");
  assert.equal(canSendBotLinkRule(payload, coach, "777"), false, "произвольный id — нельзя");
  assert.equal(canSendBotLinkRule(payload, coach, "abc"), false, "не число — нельзя");
});

test("main trainer messages only known clients", () => {
  const payload = base({ clients: [{ id: "c", telegramId: "500", coachId: null }] });
  assert.equal(canSendBotLinkRule(payload, { id: TRAINER, username: null }, "500"), true);
  assert.equal(canSendBotLinkRule(payload, { id: TRAINER, username: null }, "999"), false);
});

test("a plain client cannot send bot messages", () => {
  const payload = base({ clients: [{ id: "c", telegramId: "500", coachId: null }] });
  assert.equal(canSendBotLinkRule(payload, { id: "500", username: null }, "500"), false);
});

test("visits are restricted to the coach's own clients", () => {
  const visits = [
    { id: "v1", clientId: "mine" },
    { id: "v2", clientId: "theirs" },
  ];
  const out = visitsForClients(visits, new Set(["mine"]));
  assert.deepEqual(out.map((v) => v.id), ["v1"]);
});
