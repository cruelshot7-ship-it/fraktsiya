import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exerciseFromBlock,
  mergeCoachTemplates,
  parseLoad,
  parseReps,
  templateFromSession,
  type ProgramTemplate,
} from "./program-template.ts";
import type { ProgramBlock } from "@/lib/program-blocks";

function block(over: Partial<ProgramBlock>): ProgramBlock {
  return { id: "b", exercise: "Жим лежа", sets: 4, reps: "8", load: "80 кг", rest: 90, side: null, group: null, ...over };
}

function tpl(id: string, coachId: string, title = id): ProgramTemplate {
  return { id, coachId, title, exercises: [], version: 1, updatedAt: "2026-10-10T00:00:00Z" };
}

test("parseReps reads a number, a range, and refuses free text as 0", () => {
  assert.deepEqual(parseReps("8-10"), { min: 8, max: 10 });
  assert.deepEqual(parseReps(" 6 - 8 "), { min: 6, max: 8 });
  assert.deepEqual(parseReps("8"), { min: 8, max: 8 });
  assert.deepEqual(parseReps("AMRAP"), { min: 0, max: 0 });
});

test("parseLoad takes the working weight, comma decimals included", () => {
  assert.equal(parseLoad("80 кг"), 80);
  assert.equal(parseLoad("10,5 кг"), 10.5);
  assert.equal(parseLoad("10-12 кг"), 10);
  assert.equal(parseLoad(""), undefined);
});

test("exerciseFromBlock keeps load and rest; a bodyweight block gets no load or unit", () => {
  assert.deepEqual(exerciseFromBlock(block({})), {
    name: "Жим лежа",
    sets: 4,
    repsMin: 8,
    repsMax: 8,
    load: 80,
    unit: "kg",
    note: "отдых 90 с",
  });
  const bodyweight = exerciseFromBlock(block({ exercise: " Подтягивания ", load: "", rest: 0 }));
  assert.equal(bodyweight.name, "Подтягивания");
  assert.equal("load" in bodyweight, false);
  assert.equal("unit" in bodyweight, false);
  assert.equal("note" in bodyweight, false);
});

test("templateFromSession drops nameless exercises and falls back to a day name", () => {
  const t = templateFromSession({ name: "День A", blocks: [block({}), block({ id: "c", exercise: "  " })] }, "1001", "tpl_x");
  assert.equal(t.id, "tpl_x");
  assert.equal(t.coachId, "1001");
  assert.equal(t.version, 1);
  assert.equal(t.exercises.length, 1);
  const unnamed = templateFromSession({ name: "  ", blocks: [block({})] }, "1001", "tpl_y");
  assert.equal(unnamed.title, "День");
});

test("mergeCoachTemplates: a delete on the coach's copy sticks; other coaches' templates stay", () => {
  const key = (id: string) => String(id);
  const current = [tpl("a", "1"), tpl("b", "2")];
  // the coach deleted "a" on their device: the incoming list has no "a"
  assert.deepEqual(
    mergeCoachTemplates(current, [], "1", key).map((t) => t.id),
    ["b"],
  );
  // a new template from the coach is kept, and a foreign one in their copy is not taken
  const merged = mergeCoachTemplates(current, [tpl("c", "1"), tpl("d", "2")], "1", key);
  assert.deepEqual(merged.map((t) => `${t.id}:${t.coachId}`), ["b:2", "c:1"]);
});
