import assert from "node:assert/strict";
import test from "node:test";
import { trainDayHints, type DayLoadInput } from "./day-load-hint.ts";

const base: DayLoadInput = { sleepHours: 8, fatigue: 2, soreness: 1, kcal: 0, targetKcal: 2000 };

test("короткий сон снижает нагрузку", () => {
  const h = trainDayHints({ ...base, sleepHours: 5 });
  assert.equal(h.length, 1);
  assert.equal(h[0].tone, "reduce");
});

test("высокая усталость или крепатура тоже снижают нагрузку", () => {
  assert.equal(trainDayHints({ ...base, fatigue: 4 })[0].tone, "reduce");
  assert.equal(trainDayHints({ ...base, soreness: 5 })[0].tone, "reduce");
});

test("хорошее самочувствие даёт предложение добавить подход или кардио", () => {
  const h = trainDayHints(base);
  assert.equal(h[0].tone, "extra");
});

test("без данных о самочувствии дополнительной нагрузки не предлагаем", () => {
  assert.deepEqual(trainDayHints({ ...base, fatigue: null, soreness: null }), []);
});

test("мало калорий за день даёт подсказку про углеводы", () => {
  const h = trainDayHints({ ...base, fatigue: null, kcal: 1200, targetKcal: 2000 });
  assert.equal(h.length, 1);
  assert.equal(h[0].tone, "fuel");
});

test("не заполнено калорий — подсказки по питанию нет", () => {
  assert.deepEqual(trainDayHints({ ...base, fatigue: null, kcal: 0 }).filter((x) => x.tone === "fuel"), []);
});
