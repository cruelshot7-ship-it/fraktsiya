import { strict as assert } from "node:assert";
import { test } from "node:test";
import { retryUpdate } from "./state-retry.ts";

class Conflict extends Error {}
const isConflict = (err: unknown) => err instanceof Conflict;

test("сохраняет с первой попытки", async () => {
  const saved: number[] = [];
  const out = await retryUpdate({
    load: async () => 1,
    mutate: (n) => n + 1,
    save: async (n) => void saved.push(n),
    isConflict,
  });
  assert.equal(out, "saved");
  assert.deepEqual(saved, [2]);
});

test("после конфликта читает свежую копию и пишет поверх неё", async () => {
  let version = 0;
  const seen: number[] = [];
  const saved: number[] = [];
  let calls = 0;
  const out = await retryUpdate({
    load: async () => (version += 1),
    mutate: (n) => {
      seen.push(n);
      return n * 10;
    },
    save: async (n) => {
      calls += 1;
      if (calls === 1) throw new Conflict();
      saved.push(n);
    },
    isConflict,
  });
  assert.equal(out, "saved");
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(saved, [20]);
});

test("без изменений ничего не пишет", async () => {
  let wrote = false;
  const out = await retryUpdate({
    load: async () => 1,
    mutate: () => null,
    save: async () => void (wrote = true),
    isConflict,
  });
  assert.equal(out, "unchanged");
  assert.equal(wrote, false);
});

test("три конфликта подряд — итог conflict, без исключения", async () => {
  let saves = 0;
  const out = await retryUpdate({
    load: async () => 1,
    mutate: (n) => n,
    save: async () => {
      saves += 1;
      throw new Conflict();
    },
    isConflict,
  });
  assert.equal(out, "conflict");
  assert.equal(saves, 3);
});

test("не конфликтная ошибка пробрасывается наружу", async () => {
  await assert.rejects(
    retryUpdate({
      load: async () => 1,
      mutate: (n) => n,
      save: async () => {
        throw new Error("db down");
      },
      isConflict,
    }),
    /db down/,
  );
});
