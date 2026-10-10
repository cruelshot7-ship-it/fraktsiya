import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addExerciseName, exerciseKey, exerciseOptions, sameExercise, SEED_EXERCISES } from "./exercises.ts";

test("keys ignore case, ё/е and repeated spaces", () => {
  assert.equal(exerciseKey("  Ягодичный   мост "), "ягодичный мост");
  assert.equal(exerciseKey("Жёсткая тяга"), "жесткая тяга");
  assert.ok(sameExercise("Жим", "жим"));
  assert.ok(!sameExercise("жим", "жим лёжа"));
});

test("options: seeds first, then custom, then history, each once", () => {
  const opts = exerciseOptions({ custom: ["Ягодичный мост", "жим"], historyNames: ["Тяга", "ягодичный мост", "Гакк-присед"] });
  assert.deepEqual(opts, [...SEED_EXERCISES, "ягодичный мост", "гакк-присед"]);
});

test("options without any input are exactly the seeds", () => {
  assert.deepEqual(exerciseOptions({}), [...SEED_EXERCISES]);
});

test("addExerciseName stores the normalized key and rejects duplicates", () => {
  const first = addExerciseName([], "  Ягодичный   мост ");
  assert.ok(first.ok);
  if (!first.ok) return;
  assert.deepEqual(first.list, ["ягодичный мост"]);
  const dup = addExerciseName(first.list, "ЯГОДИЧНЫЙ МОСТ");
  assert.equal(dup.ok, false);
  const seedDup = addExerciseName([], "Присед");
  assert.equal(seedDup.ok, false, "a seed name cannot be added twice");
});

test("addExerciseName rejects empty, too long and over the cap", () => {
  assert.equal(addExerciseName([], "   ").ok, false);
  assert.equal(addExerciseName([], "а".repeat(41)).ok, false);
  const full = Array.from({ length: 30 }, (_, i) => `упр ${i}`);
  assert.equal(addExerciseName(full, "новое").ok, false);
});
