import assert from "node:assert/strict";
import test from "node:test";
import { checkFlushEvent, messageText } from "./flush-rules.ts";

const trainer = { role: "trainer" as const, userId: "100" };
const client = { role: "client" as const, userId: "200" };
const ev = (over: Partial<{ kind: string; telegramId: string; payload: Record<string, unknown> }> = {}) => ({
  id: "e1",
  kind: "booking_confirmed",
  telegramId: "200",
  payload: { date: "2026-10-12", time: "18:00" },
  ...over,
});

test("без проверенной сессии ничего не отправляется", () => {
  assert.deepEqual(checkFlushEvent(ev(), null), { ok: false, error: "not-allowed" });
});

test("клиент пишет только себе, тренер — любому", () => {
  assert.equal(checkFlushEvent(ev({ telegramId: "200" }), client).ok, true);
  assert.deepEqual(checkFlushEvent(ev({ telegramId: "999" }), client), { ok: false, error: "forbidden" });
  assert.equal(checkFlushEvent(ev({ telegramId: "999" }), trainer).ok, true);
});

test("неизвестный вид уведомления и кривой адресат отбрасываются", () => {
  assert.deepEqual(checkFlushEvent(ev({ kind: "phishing" }), trainer), { ok: false, error: "kind" });
  assert.deepEqual(checkFlushEvent(ev({ telegramId: "abc" }), trainer), { ok: false, error: "recipient" });
});

test("текст не берёт произвольные строки из payload", () => {
  assert.equal(messageText("booking_confirmed", { date: "2026-10-12", time: "18:00" }), "Запись подтверждена: 2026-10-12 · 18:00");
  assert.equal(messageText("booking_confirmed", { date: "Перейдите по ссылке", time: "x" }), "Запись подтверждена.");
  assert.equal(messageText("generic", { text: "переведите деньги" }), "Новое уведомление из зала.");
});
