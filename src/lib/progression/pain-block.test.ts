import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyPainBlock, painBlocksProgression, PAIN_BLOCK_DAYS } from "./pain-block.ts";

const TODAY = "2026-10-13";
const ago = (d: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - d * 86400000).toISOString().slice(0, 10);

test("боль блокирует на 7 дней, включая сегодня; без боли — нет", () => {
  assert.equal(PAIN_BLOCK_DAYS, 7);
  assert.equal(painBlocksProgression([{ date: TODAY, pain: 1 }], TODAY), true);
  assert.equal(painBlocksProgression([{ date: ago(6), pain: 2 }], TODAY), true);
  assert.equal(painBlocksProgression([{ date: ago(7), pain: 2 }], TODAY), false, "8-й день уже не блокирует");
  assert.equal(painBlocksProgression([{ date: TODAY, pain: 0 }], TODAY), false);
  assert.equal(painBlocksProgression([{ date: TODAY }], TODAY), false);
  assert.equal(painBlocksProgression([{ date: "2026-10-20", pain: 3 }], TODAY), false, "будущий чек-ин не блокирует");
});

const base = {
  status: "pending" as const,
  explanation: "Можно повысить.",
  basedOnResultIds: ["r1"],
  proposedChanges: [
    { exercise: "Присед", fromLoad: 100, toLoad: 102.5, unit: "kg" as const, reason: "x" },
    { exercise: "Жим", fromLoad: 80, toLoad: 75, unit: "kg" as const, reason: "y" },
  ],
};

test("при блокировке повышения убираются, снижения остаются, объяснение дополняется", () => {
  const out = applyPainBlock(base, true);
  assert.deepEqual(out.proposedChanges.map((c) => c.exercise), ["Жим"]);
  assert.match(out.explanation, /Повышение нагрузки не предлагаем/);
});

test("без блокировки предложение не меняется", () => {
  assert.equal(applyPainBlock(base, false), base);
});
