import { strict as assert } from "node:assert";
import { test } from "node:test";
import { rirLabel, type ProgramBlock } from "./program-blocks.ts";
import {
  blockLines,
  blocksFromItems,
  itemsFromBlocks,
  legacyMarkMap,
  PHASE_LABEL,
  PHASES,
  parseFactKg,
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

test("target RIR lives in the block and survives a save, items stay unchanged", () => {
  const blocks = blocksFromItems(["Жим лёжа", "3×8", "60 кг"]).map((b) => ({ ...b, rir: 2 }));
  const session = withBlocks({ id: "s1", name: "День A", focus: "Грудь", items: [] as string[] }, blocks);
  assert.deepEqual(session.items, ["Жим лёжа", "3×8", "60 кг"], "rir is not written into lines");
  const plan = sessionPlan(session);
  assert.equal(plan.blocks[0].rir, 2, "stored blocks keep rir");
  assert.equal(plan.blocks[0].id, blocks[0].id);
});

test("a block without RIR reads as null, not as 0", () => {
  const blocks = blocksFromItems(["Тяга", "4×10"]);
  assert.equal(blocks[0].rir ?? null, null);
  const session = withBlocks({ id: "s2", name: "День B", focus: "Спина", items: [] as string[] }, blocks);
  assert.equal(sessionPlan(session).blocks[0].rir ?? null, null);
});

test("phases are the three fixed keys with Russian labels", () => {
  assert.deepEqual(PHASES, ["build", "peak", "deload"]);
  assert.equal(PHASE_LABEL.build, "набор");
  assert.equal(PHASE_LABEL.peak, "пик");
  assert.equal(PHASE_LABEL.deload, "разгрузка");
});

test("setCount: sets for both sides, at least one set for a block without a scheme", async () => {
  const { setCount } = await import("./program-blocks.ts");
  const base = { id: "b1", exercise: "Выпады", reps: "8", load: "20", rest: 90, side: null, group: null } as ProgramBlock;
  assert.equal(setCount({ ...base, sets: 3 }), 3);
  assert.equal(setCount({ ...base, sets: 3, side: "ногу" }), 6);
  assert.equal(setCount({ ...base, sets: 0 }), 1);
});

test("nextSet: walks the sets of one exercise, then moves on; a finished block is skipped", async () => {
  const { nextSet, setMark } = await import("./program-blocks.ts");
  const a = { id: "a", exercise: "A", sets: 3, reps: "8", load: "", rest: 90, side: null, group: null } as ProgramBlock;
  const b = { id: "b", exercise: "B", sets: 2, reps: "10", load: "", rest: 60, side: null, group: null } as ProgramBlock;
  assert.deepEqual(nextSet([a, b], [], []), { block: a, index: 0, total: 3 });
  assert.deepEqual(nextSet([a, b], [], [setMark("a", 0), setMark("a", 1)]), { block: a, index: 2, total: 3 });
  // блок a отмечен целиком: переход к b
  assert.deepEqual(nextSet([a, b], ["a"], []), { block: b, index: 0, total: 2 });
  assert.equal(nextSet([a, b], ["a", "b"], []), null);
});

test("setsDone: a block checked as a whole (older marks) counts all its sets", async () => {
  const { setsDone, setMark } = await import("./program-blocks.ts");
  const a = { id: "a", exercise: "A", sets: 3, reps: "8", load: "", rest: 90, side: null, group: null } as ProgramBlock;
  assert.equal(setsDone(a, [setMark("a", 0)], false), 1);
  assert.equal(setsDone(a, [], true), 3);
});

test("applySetMark: the block is done only when its last set is marked; unmarking any set undoes it", async () => {
  const { applySetMark, setMark } = await import("./program-blocks.ts");
  let r = applySetMark([], [], "a", 0, 3, true);
  assert.deepEqual(r.marks, [setMark("a", 0)]);
  assert.deepEqual(r.checked, []);
  r = applySetMark(r.marks, r.checked, "a", 1, 3, true);
  r = applySetMark(r.marks, r.checked, "a", 2, 3, true);
  assert.deepEqual(r.checked, ["a"]);
  // снятие одного подхода снимает блок целиком
  r = applySetMark(r.marks, r.checked, "a", 1, 3, false);
  assert.deepEqual(r.checked, []);
  assert.equal(r.marks.includes(setMark("a", 1)), false);
});

test("applySetMark: marking the same set twice does not duplicate marks", async () => {
  const { applySetMark, setMark } = await import("./program-blocks.ts");
  const once = applySetMark([], [], "a", 0, 2, true);
  const twice = applySetMark(once.marks, once.checked, "a", 0, 2, true);
  assert.deepEqual(twice.marks, [setMark("a", 0)]);
});

test("rirLabel: 0 — до отказа, остальное — запас повторов", () => {
  assert.equal(rirLabel(0), "до отказа");
  assert.equal(rirLabel(1), "запас 1 повт.");
  assert.equal(rirLabel(3), "запас 3 повт.");
});

test("parseFactKg accepts comma, dot and a unit, rejects garbage and out-of-range", () => {
  assert.equal(parseFactKg("22,5"), 22.5);
  assert.equal(parseFactKg("22.5"), 22.5);
  assert.equal(parseFactKg(" 20 кг "), 20);
  assert.equal(parseFactKg("20кг"), 20);
  assert.equal(parseFactKg("20"), 20);
  assert.equal(parseFactKg(""), null);
  assert.equal(parseFactKg("2x20"), null);
  assert.equal(parseFactKg("1,2,3"), null);
  assert.equal(parseFactKg("0"), null);
  assert.equal(parseFactKg("1500"), null);
});

test("planTotalsFromBlocks uses the typed fact, falls back to plan when the fact is unreadable", () => {
  const b: ProgramBlock = { id: "p", exercise: "Жим", sets: 3, reps: "10", load: "20", rest: null, side: null, group: null };
  const plain = planTotalsFromBlocks([b], ["p"], {});
  assert.ok(plain.volume > 0, "у блока есть план веса");
  const comma = planTotalsFromBlocks([b], ["p"], { p: "22,5" });
  assert.equal(comma.volume, planTotalsFromBlocks([b], ["p"], { p: "22.5" }).volume);
  assert.notEqual(comma.volume, plain.volume);
  assert.equal(planTotalsFromBlocks([b], ["p"], { p: "abc" }).volume, plain.volume);
});
