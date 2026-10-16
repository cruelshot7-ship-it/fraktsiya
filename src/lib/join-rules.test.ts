import { test } from "node:test";
import assert from "node:assert/strict";
import { isInHall } from "./join-rules";

test("isInHall: клиент с тем же telegramId уже в зале", () => {
  assert.equal(isInHall([{ telegramId: "528925208" }], 528925208), true);
  assert.equal(isInHall([{ telegramId: "528925208" }], "528925208"), true);
});

test("isInHall: карточка только с @username (без telegramId) — не в зале, заявка должна создаться", () => {
  // регрессия: раньше совпадение по юзернейму возвращало «уже в зале», и заявка не создавалась
  const manual = [{ telegramId: null }];
  assert.equal(isInHall(manual, "528925208"), false);
});

test("isInHall: чужой telegramId и пустой список — не в зале", () => {
  assert.equal(isInHall([{ telegramId: "111" }], "222"), false);
  assert.equal(isInHall([], "222"), false);
  assert.equal(isInHall([{ telegramId: "" }], ""), false);
});
