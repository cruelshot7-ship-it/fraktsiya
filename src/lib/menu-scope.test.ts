import assert from "node:assert/strict";
import test from "node:test";
import {
  applyClientChoices,
  checkMenuRecord,
  keepClientChoices,
  isMenuStale,
  menuChoiceLogs,
  mergeMenus,
  menusForClient,
  pruneMenus,
  validChoice,
  type MenuRecord,
} from "./menu-scope.ts";

const T1 = "2026-10-11T10:00:00.000Z";
const T2 = "2026-10-11T11:00:00.000Z";

function rec(clientId: string, date: string, extra: Partial<MenuRecord> = {}): MenuRecord {
  const confirmed = extra.confirmed ?? false;
  return {
    id: `${clientId}_${date}`,
    clientId,
    date,
    count: 3,
    offers: { breakfast: ["oats", "eggs"], lunch: ["bowl"] },
    dishes: {},
    choice: {},
    confirmed,
    confirmedAt: confirmed ? T1 : null,
    targetKcal: 2000,
    updatedAt: "2026-10-11T12:00:00.000Z",
    ...extra,
  };
}

test("проверка записи: корректная проходит, мусор отбрасывается", () => {
  const ok = checkMenuRecord({ id: "a", clientId: "c1", date: "2026-10-12", count: 4, offers: { lunch: ["bowl"] }, confirmed: true });
  assert.ok(ok);
  assert.equal(ok.count, 4);
  assert.equal(ok.confirmed, true);
  assert.equal(checkMenuRecord(null), null);
  assert.equal(checkMenuRecord({ id: "a", clientId: "c1", date: "12.10.2026", count: 3, offers: {} }), null);
  assert.equal(checkMenuRecord({ id: "a", clientId: "c1", date: "2026-10-12", count: 2, offers: {} }), null);
  assert.equal(checkMenuRecord({ id: "a", clientId: "c1", date: "2026-10-12", count: 3, offers: [] }), null);
});

test("проверка записи: вариантов не больше трёх, неверные блюда отбрасываются", () => {
  const r = checkMenuRecord({
    id: "a",
    clientId: "c1",
    date: "2026-10-12",
    count: 3,
    offers: { breakfast: ["oats", "eggs", "yogurt", "omelette"], lunch: [42, ""] },
  });
  assert.ok(r);
  assert.equal(r.offers.breakfast.length, 3);
  assert.deepEqual(r.offers.lunch, []);
});

test("выбор клиента, которого нет среди вариантов, отбрасывается", () => {
  const r = checkMenuRecord({
    id: "a",
    clientId: "c1",
    date: "2026-10-12",
    count: 3,
    offers: { breakfast: ["oats"] },
    choice: { breakfast: "oats", lunch: "bowl" },
  });
  assert.ok(r);
  assert.deepEqual(r.choice, { breakfast: "oats" });
});

test("validChoice оставляет только предложенные блюда", () => {
  assert.deepEqual(validChoice({ breakfast: "oats", lunch: "pasta" }, { breakfast: ["oats"], lunch: ["bowl"] }), { breakfast: "oats" });
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
  const merged = mergeMenus([rec("gone", "2026-10-12")], [], new Set(["gone"]));
  assert.equal(merged.length, 0);
});

test("на один день одного клиента остаётся одна запись", () => {
  const merged = mergeMenus([], [rec("c1", "2026-10-12", { count: 3 }), rec("c1", "2026-10-12", { count: 4 })], new Set(["c1"]));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].count, 4);
});

test("клиент пишет выбор только в подтверждённом меню и только из вариантов", () => {
  const current = [rec("c1", "2026-10-12", { confirmed: true }), rec("c1", "2026-10-13", { confirmed: false })];
  const incoming = [
    rec("c1", "2026-10-12", { choice: { breakfast: "eggs", lunch: "bowl" }, confirmed: true }),
    rec("c1", "2026-10-13", { choice: { breakfast: "oats" } }),
  ];
  const out = applyClientChoices(current, incoming, "c1");
  assert.deepEqual(out.find((m) => m.date === "2026-10-12")?.choice, { breakfast: "eggs", lunch: "bowl" });
  assert.deepEqual(out.find((m) => m.date === "2026-10-13")?.choice, {}, "черновик клиент не меняет");
});

test("клиент не меняет варианты тренера и меню чужих клиентов", () => {
  const current = [rec("c1", "2026-10-12", { confirmed: true }), rec("c2", "2026-10-12", { confirmed: true })];
  const incoming = [
    rec("c1", "2026-10-12", { confirmed: true, offers: { breakfast: ["pasta"] }, choice: { breakfast: "pasta" } }),
    rec("c2", "2026-10-12", { choice: { breakfast: "oats" } }),
  ];
  const out = applyClientChoices(current, incoming, "c1");
  assert.deepEqual(out.find((m) => m.clientId === "c1")?.offers, { breakfast: ["oats", "eggs"], lunch: ["bowl"] });
  assert.deepEqual(out.find((m) => m.clientId === "c2")?.choice, {});
});

test("локальный выбор клиента не сбрасывается присланным сервером состоянием", () => {
  const server = [rec("c1", "2026-10-12", { confirmed: true, offers: { breakfast: ["oats", "eggs"] } })];
  const local = [rec("c1", "2026-10-12", { confirmed: true, choice: { breakfast: "eggs" } })];
  const kept = keepClientChoices(server, local);
  assert.deepEqual(kept[0].choice, { breakfast: "eggs" });
});

test("выбор клиента не переносится на новое подтверждение тренера", () => {
  const current = [rec("c1", "2026-10-12", { confirmed: true, confirmedAt: T2 })];
  const incoming = [rec("c1", "2026-10-12", { confirmed: true, confirmedAt: T1, choice: { breakfast: "eggs" } })];
  const out = applyClientChoices(current, incoming, "c1");
  assert.deepEqual(out[0].choice, {}, "старое подтверждение не записывает выбор");
});

test("локальный выбор клиента не возвращается после пересборки тренера", () => {
  const server = [rec("c1", "2026-10-12", { confirmed: true, confirmedAt: T2 })];
  const local = [rec("c1", "2026-10-12", { confirmed: true, confirmedAt: T1, choice: { breakfast: "eggs" } })];
  assert.deepEqual(keepClientChoices(server, local)[0].choice, {});
});

test("выбор сохраняется для того же подтверждения", () => {
  const server = [rec("c1", "2026-10-12", { confirmed: true, confirmedAt: T1 })];
  const local = [rec("c1", "2026-10-12", { confirmed: true, confirmedAt: T1, choice: { breakfast: "oats" } })];
  assert.deepEqual(keepClientChoices(server, local)[0].choice, { breakfast: "oats" });
});

test("проверка записи: снимки блюд без мусора, подтверждение с датой", () => {
  const r = checkMenuRecord({
    id: "a",
    clientId: "c1",
    date: "2026-10-12",
    count: 3,
    offers: { breakfast: ["oats", "bad"] },
    dishes: {
      oats: { name: "Овсянка", calories: 420, protein: 24, fat: 14, carbs: 48 },
      bad: { name: "", calories: -1, protein: 1, fat: 1, carbs: 1 },
      huge: { name: "x", calories: 99999, protein: 1, fat: 1, carbs: 1 },
    },
    confirmed: true,
    confirmedAt: T1,
  });
  assert.ok(r);
  assert.deepEqual(Object.keys(r.dishes), ["oats"]);
  assert.equal(r.confirmedAt, T1);
});

test("записи журнала из меню: одна запись на приём, смена блюда заменяет, без дублей", () => {
  const dish = { name: "Овсянка", calories: 420, protein: 24, fat: 14, carbs: 48 };
  const r = rec("c1", "2026-10-12", { confirmed: true, offers: { breakfast: ["oats"] }, dishes: { oats: dish }, choice: { breakfast: "oats" } });
  const logs = menuChoiceLogs(r, () => undefined);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].logId, "menu_c1_2026-10-12_breakfast");
  assert.equal(logs[0].calories, 420);
  assert.equal(logs[0].date, "2026-10-12");
});

test("запись журнала берёт блюдо из базы, если снимка нет", () => {
  const r = rec("c1", "2026-10-12", { confirmed: true, offers: { lunch: ["bowl"] }, choice: { lunch: "bowl" } });
  const logs = menuChoiceLogs(r, (id) => (id === "bowl" ? { name: "Боул", calories: 600, protein: 40, fat: 20, carbs: 60 } : undefined));
  assert.equal(logs[0].name, "Боул");
});

test("меню, собранное на другую норму, устаревает", () => {
  assert.equal(isMenuStale({ targetKcal: 2000 }, 2010), false, "в пределах 2%");
  assert.equal(isMenuStale({ targetKcal: 2000 }, 2300), true);
  assert.equal(isMenuStale({ targetKcal: null }, 2300), false, "старые записи без нормы не трогаем");
});

test("старые меню удаляются, свежие остаются", () => {
  const menus = [rec("c1", "2026-10-11"), rec("c1", "2026-08-01"), rec("c1", "2026-08-20")];
  const kept = pruneMenus(menus, "2026-10-11", 60).map((m) => m.date);
  assert.deepEqual(kept.sort(), ["2026-08-20", "2026-10-11"]);
});
