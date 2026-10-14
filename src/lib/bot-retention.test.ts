import { test } from "node:test";
import assert from "node:assert/strict";
import { BOT_MESSAGE_TTL_MS, deleteAfter, deleteVerdict, isDue, MAX_DELETE_ATTEMPTS } from "./bot-retention";

test("срок — ровно сутки после отправки", () => {
  const sent = new Date("2026-10-14T08:00:00Z");
  assert.equal(deleteAfter(sent).getTime() - sent.getTime(), BOT_MESSAGE_TTL_MS);
  assert.equal(BOT_MESSAGE_TTL_MS, 24 * 60 * 60 * 1000);
});

test("к удалению: срок прошёл и запись не закрыта", () => {
  const sent = new Date("2026-10-14T08:00:00Z");
  const row = { deleteAfter: deleteAfter(sent), deletedAt: null };
  assert.equal(isDue(row, new Date(sent.getTime() + BOT_MESSAGE_TTL_MS - 1)), false);
  assert.equal(isDue(row, new Date(sent.getTime() + BOT_MESSAGE_TTL_MS)), true);
});

test("закрытая запись к удалению не попадает", () => {
  const sent = new Date("2026-10-14T08:00:00Z");
  const row = { deleteAfter: deleteAfter(sent), deletedAt: new Date() };
  assert.equal(isDue(row, new Date(sent.getTime() + 10 * BOT_MESSAGE_TTL_MS)), false);
});

test("ответ Telegram: успех и уже удалённое сообщение — готово", () => {
  assert.equal(deleteVerdict({ ok: true }, 0), "done");
  assert.equal(deleteVerdict({ ok: false, description: "Bad Request: message to delete not found", errorCode: 400 }, 0), "done");
});

test("временные сбои повторяются, пока не исчерпан лимит", () => {
  assert.equal(deleteVerdict({ ok: false, errorCode: 429, description: "Too Many Requests" }, 0), "retry");
  assert.equal(deleteVerdict({ ok: false, errorCode: 502, description: "Bad Gateway" }, 1), "retry");
  assert.equal(deleteVerdict({ ok: false, description: "network" }, MAX_DELETE_ATTEMPTS - 2), "retry");
});

test("на последней попытке временный сбой закрывает запись", () => {
  assert.equal(deleteVerdict({ ok: false, description: "network" }, MAX_DELETE_ATTEMPTS - 1), "give_up");
});

test("постоянный отказ закрывается, а не повторяется", () => {
  assert.equal(deleteVerdict({ ok: false, errorCode: 400, description: "Bad Request: message can't be deleted" }, 0), "give_up");
  assert.equal(deleteVerdict({ ok: false, errorCode: 403, description: "Forbidden" }, 0), "give_up");
});
