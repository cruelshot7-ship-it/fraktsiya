import { test } from "node:test";
import assert from "node:assert/strict";
import { popTab, pushTab, TAB_HISTORY_LIMIT } from "./tab-history.ts";

test("pushTab запоминает текущий экран", () => {
  assert.deepEqual(pushTab<string>([], "today", "clients"), ["today"]);
  assert.deepEqual(pushTab(["today"], "clients", "program"), ["today", "clients"]);
});

test("pushTab на тот же экран не меняет стек", () => {
  assert.deepEqual(pushTab(["today"], "clients", "clients"), ["today"]);
});

test("pushTab ограничивает глубину", () => {
  let h: string[] = [];
  for (let i = 0; i < TAB_HISTORY_LIMIT + 5; i++) h = pushTab(h, `t${i}`, `t${i + 1}`);
  assert.equal(h.length, TAB_HISTORY_LIMIT);
  assert.equal(h[h.length - 1], `t${TAB_HISTORY_LIMIT + 4}`);
});

test("popTab возвращает последний экран", () => {
  assert.deepEqual(popTab(["today", "clients"]), { tab: "clients", history: ["today"] });
  assert.deepEqual(popTab(["today"]), { tab: "today", history: [] });
});

test("popTab на пустом стеке возвращает null", () => {
  assert.deepEqual(popTab<string>([]), { tab: null, history: [] });
});
