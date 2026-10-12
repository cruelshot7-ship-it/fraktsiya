import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isLapsed, lastActivityDate, LAPSED_DAYS } from "./lapsed.ts";

const TODAY = "2026-10-13";
const ago = (days: number) => {
  const d = new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86400000);
  return d.toISOString().slice(0, 10);
};

test("последняя активность — самый поздний визит, иначе старт программы", () => {
  assert.equal(lastActivityDate(["2026-09-01", "2026-10-02", "2026-08-30"]), "2026-10-02");
  assert.equal(lastActivityDate([], "2026-07-01"), "2026-07-01");
  assert.equal(lastActivityDate([]), null);
});

test("ушедший: больше 60 дней без визитов и без записи вперёд", () => {
  assert.equal(LAPSED_DAYS, 60);
  assert.equal(isLapsed({ lastActivity: ago(61), hasUpcoming: false, today: TODAY }), true);
  assert.equal(isLapsed({ lastActivity: ago(59), hasUpcoming: false, today: TODAY }), false);
  assert.equal(isLapsed({ lastActivity: ago(61), hasUpcoming: true, today: TODAY }), false, "есть запись вперёд");
  assert.equal(isLapsed({ lastActivity: ago(61), hasUpcoming: false, erased: true, today: TODAY }), false, "стёртые не в списке");
  assert.equal(isLapsed({ lastActivity: null, hasUpcoming: false, today: TODAY }), false, "нет данных — не ушедший");
});
