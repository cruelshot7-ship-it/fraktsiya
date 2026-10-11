import assert from "node:assert/strict";
import test from "node:test";
import { checkMenuRecord, mergeMenus, menusForClient, type MenuRecord } from "./menu-scope.ts";

function rec(clientId: string, date: string, extra: Partial<MenuRecord> = {}): MenuRecord {
  return {
    id: `${clientId}_${date}`,
    clientId,
    date,
    count: 3,
    selection: { breakfast: "oats" },
    confirmed: false,
    updatedAt: "2026-10-11T12:00:00.000Z",
    ...extra,
  };
}

test("проверка записи: корректная проходит, мусор отбрасывается", () => {
  const ok = checkMenuRecord({ id: "a", clientId: "c1", date: "2026-10-12", count: 4, selection: { lunch: "bowl" }, confirmed: true });
  assert.ok(ok);
  assert.equal(ok.count, 4);
  assert.equal(ok.confirmed, true);
  assert.equal(checkMenuRecord(null), null);
  assert.equal(checkMenuRecord({ id: "a", clientId: "c1", date: "12.10.2026", count: 3, selection: {} }), null);
  assert.equal(checkMenuRecord({ id: "a", clientId: "c1", date: "2026-10-12", count: 2, selection: {} }), null);
  assert.equal(checkMenuRecord({ id: "a", clientId: "c1", date: "2026-10-12", count: 3, selection: [] }), null);
});

test("проверка записи: неверные блюда в выборе отбрасываются, остальное сохраняется", () => {
  const r = checkMenuRecord({
    id: "a",
    clientId: "c1",
    date: "2026-10-12",
    count: 3,
    selection: { breakfast: "oats", lunch: 42, dinner: "" },
  });
  assert.ok(r);
  assert.deepEqual(r.selection, { breakfast: "oats" });
  assert.equal(r.confirmed, false, "без явного true запись не подтверждена");
});

test("клиент видит только свои подтверждённые меню", () => {
  const menus = [
    rec("c1", "2026-10-12", { confirmed: true }),
    rec("c1", "2026-10-13", { confirmed: false }),
    rec("c2", "2026-10-12", { confirmed: true }),
  ];
  const seen = menusForClient(menus, "c1");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].date, "2026-10-12");
});

test("без клиента меню не показываются", () => {
  assert.deepEqual(menusForClient([rec("c1", "2026-10-12", { confirmed: true })], null), []);
});

test("слияние заменяет меню своих клиентов и не трогает чужих", () => {
  const current = [rec("mine", "2026-10-12"), rec("other", "2026-10-12", { confirmed: true })];
  const incoming = [rec("mine", "2026-10-12", { count: 5 }), rec("mine", "2026-10-13")];
  const merged = mergeMenus(current, incoming, new Set(["mine"]));
  const mine = merged.filter((m) => m.clientId === "mine");
  assert.equal(mine.length, 2);
  assert.equal(mine.find((m) => m.date === "2026-10-12")?.count, 5);
  assert.equal(merged.filter((m) => m.clientId === "other").length, 1);
});

test("меню клиента, которого нет в пришедшем списке своих, удаляется", () => {
  const current = [rec("gone", "2026-10-12")];
  const merged = mergeMenus(current, [], new Set(["gone"]));
  assert.equal(merged.length, 0);
});

test("на один день одного клиента остаётся одна запись", () => {
  const merged = mergeMenus([], [rec("c1", "2026-10-12", { count: 3 }), rec("c1", "2026-10-12", { count: 4 })], new Set(["c1"]));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].count, 4);
});
