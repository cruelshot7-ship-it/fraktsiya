import { strict as assert } from "node:assert";
import { test } from "node:test";
import { programProgress } from "./program-status.ts";

test("первая неделя — первые 7 дней, старт в будущем тоже неделя 1", () => {
  assert.deepEqual(programProgress(0, 8), { week: 1, finished: false });
  assert.deepEqual(programProgress(6, 8), { week: 1, finished: false });
  assert.deepEqual(programProgress(-3, 8), { week: 1, finished: false });
});

test("последняя неделя не завершена, после неё программа завершена и номер не растёт", () => {
  assert.deepEqual(programProgress(7 * 7, 8), { week: 8, finished: false });
  assert.deepEqual(programProgress(7 * 8 - 1, 8), { week: 8, finished: false });
  assert.deepEqual(programProgress(7 * 8, 8), { week: 8, finished: true });
  assert.deepEqual(programProgress(7 * 30, 8), { week: 8, finished: true });
});

test("некорректное число недель считается как 1 неделя", () => {
  assert.deepEqual(programProgress(0, 0), { week: 1, finished: false });
  assert.deepEqual(programProgress(7, 0), { week: 1, finished: true });
});
