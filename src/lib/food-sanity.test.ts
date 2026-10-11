import assert from "node:assert/strict";
import test from "node:test";
import { kcalFromMacros, macrosSane } from "./food-sanity.ts";

test("разумные значения проходят", () => {
  assert.equal(macrosSane({ calories: 539, protein: 6.3, fat: 30.9, carbs: 57.5 }), true); // Nutella
  assert.equal(macrosSane({ calories: 748, protein: 0.5, fat: 82.5, carbs: 0.8 }), true); // сливочное масло
});

test("нелепые значения отбрасываются", () => {
  assert.equal(macrosSane({ calories: 5000, protein: 1, fat: 1, carbs: 1 }), false);
  assert.equal(macrosSane({ calories: 500, protein: 60, fat: 40, carbs: 30 }), false);
  assert.equal(macrosSane({ calories: -1, protein: 1, fat: 1, carbs: 1 }), false);
  assert.equal(macrosSane({ calories: Number.NaN, protein: 1, fat: 1, carbs: 1 }), false);
});

test("ккал по макросам", () => {
  assert.equal(kcalFromMacros({ protein: 12.6, fat: 3.3, carbs: 62 }), 328); // гречка, как в каталоге 334
});
