import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { ProgramBlock } from "./program-blocks.ts";
import {
  blockLines,
  blocksFromItems,
  itemsFromBlocks,
  legacyMarkMap,
  planTotalsFromBlocks,
  rewriteFacts,
  rewriteMarks,
  sessionPlan,
  withBlocks,
} from "./program-blocks.ts";

const PRESET_LIKE = [
  "Жим лёжа",
  "3×8-10",
  "62,5 кг",
  "Отдых 90 секунд",
  "Тяга верхнего блока",
  "3×8-10",
  "55 кг",
  "Отдых 90 секунд",
  "Подъём на носки",
  "3×12-15",
];

test("round trip: plain lines -> blocks -> the same lines", () => {
  assert.deepEqual(itemsFromBlocks(blocksFromItems(PRESET_LIKE)), PRESET_LIKE);
});

test("a text line starts a block and its sets, load and rest attach to it", () => {
  const [a, b, c] = blocksFromItems(PRESET_LIKE);
  assert.equal(a.exercise, "Жим лёжа");
  assert.equal(a.sets, 3);
  assert.equal(a.reps, "8-10");
  assert.equal(a.load, "62,5");
  assert.equal(a.rest, 90);
  assert.equal(b.exercise, "Тяга верхнего блока");
  assert.equal(c.exercise, "Подъём на носки");
  assert.equal(c.load, "");
  assert.equal(c.rest, null);
});

test("'на каждую руку / ногу / сторону' counts both sides and survives the round trip", () => {
  const lines = ["Гантели", "3×8 на каждую руку", "20 кг"];
  const [b] = blocksFromItems(lines);
  assert.equal(b.side, "руку");
  assert.deepEqual(itemsFromBlocks([blocksFromItems(["Разгибание", "3×12 на каждую ногу", "15 кг"])[0]]), ["Разгибание", "3×12 на каждую ногу", "15 кг"]);
  assert.equal(blocksFromItems(["Выпады", "3×10 на каждую сторону"])[0].side, "сторону");
  assert.deepEqual(itemsFromBlocks([b]), lines);
  assert.deepEqual(planTotalsFromBlocks([{ ...b, id: "x" }], ["x"], {}), { sets: 6, volume: 960, restSec: 0 });
});

test("supersets are never inferred from line order", () => {
  const blocks = blocksFromItems(PRESET_LIKE);
  assert.ok(blocks.every((b) => b.group === null));
});

test("a sets line with no block before it becomes a block of its own, nothing is lost", () => {
  const lines = ["3×8", "Тяга", "3×10"];
  assert.deepEqual(itemsFromBlocks(blocksFromItems(lines)), lines);
});

test("authored blocks win while they match the lines", () => {
  const authored = [
    { id: "bl_1", exercise: "Ягодичный мост", sets: 3, reps: "12", load: "", rest: 60, side: null, group: null },
  ];
  const session = withBlocks({ items: [] as string[] }, authored);
  assert.deepEqual(session.items, blockLines(authored[0]));
  assert.equal(sessionPlan(session).blocks[0].id, "bl_1");
});

test("an older writer that changed the lines wins over stale blocks", () => {
  const session = {
    items: ["Присед", "4×6", "Отдых 120 секунд"],
    blocks: [{ id: "bl_1", exercise: "Жим", sets: 3, reps: "8", load: "", rest: null, side: null, group: null }],
  };
  const plan = sessionPlan(session);
  assert.equal(plan.blocks[0].exercise, "Присед");
  assert.equal(plan.blocks[0].sets, 4);
});

test("legacy marks and facts move to block ids; a multi-line block gets one id", () => {
  const session = { items: [...PRESET_LIKE] };
  const map = legacyMarkMap(session);
  // line 1 ("3×8-10") and line 2 ("62,5 кг") both belong to the first block
  assert.equal(map["1:3×8-10"], map["2:62,5 кг"]);
  const marks = rewriteMarks(["1:3×8-10", "2:62,5 кг", "3:Отдых 90 секунд", "0:Жим лёжа"], map);
  assert.equal(marks.length, 1, "all four legacy marks belong to the same block");
  const facts = rewriteFacts({ "2": "65" }, session);
  assert.equal(facts[sessionPlan(session).blocks[0].id], "65");
});

test("totals: planned load, typed fact overrides, rest of checked blocks only", () => {
  const blocks = blocksFromItems(PRESET_LIKE);
  const first = blocks[0];
  assert.deepEqual(planTotalsFromBlocks(blocks, [first.id], {}), { sets: 3, volume: 1688, restSec: 90 });
  assert.deepEqual(planTotalsFromBlocks(blocks, [first.id], { [first.id]: "70" }), { sets: 3, volume: 1890, restSec: 90 });
  assert.deepEqual(planTotalsFromBlocks(blocks, [], {}), { sets: 0, volume: 0, restSec: 0 });
});

test("a block without load adds sets to no volume", () => {
  const blocks = blocksFromItems(["Подъём на носки", "3×12-15"]);
  assert.deepEqual(planTotalsFromBlocks(blocks, [blocks[0].id], {}), { sets: 0, volume: 0, restSec: 0 });
});

test("blocks stored before 'side' existed keep their id and lines", () => {
  // what the previous version stored: perSide flag, items already say "на каждую руку"
  const legacy = [
    { id: "bl_old", exercise: "Гантели", sets: 3, reps: "8", load: "20", rest: null, perSide: true, group: null },
  ] as unknown as ProgramBlock[];
  const items = ["Гантели", "3×8 на каждую руку", "20 кг"];
  const plan = sessionPlan({ items, blocks: legacy });
  assert.equal(plan.blocks[0].id, "bl_old", "consistent legacy blocks keep their ids");
  assert.equal(plan.blocks[0].side, "руку");
  assert.deepEqual(itemsFromBlocks(plan.blocks), items);
});
