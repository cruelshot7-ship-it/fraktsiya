import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assignTemplateToClient, bumpTemplate, type ProgramTemplate } from "./program-template.ts";

const base: ProgramTemplate = {
  id: "tpl1",
  coachId: "coach_a",
  title: "База 4 нед",
  exercises: [{ name: "Присед", sets: 3, repsMin: 5, repsMax: 8, load: 60, unit: "kg" }],
  version: 1,
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("program templates", () => {
  it("assign creates independent copy", () => {
    const copy = assignTemplateToClient(base, "client_1");
    const updated = bumpTemplate(base, {
      exercises: [{ name: "Присед", sets: 4, repsMin: 5, repsMax: 8, load: 80, unit: "kg" }],
    });
    assert.equal(copy.exercises[0].load, 60);
    assert.equal(updated.exercises[0].load, 80);
    assert.equal(updated.version, 2);
    assert.equal(copy.templateVersionAtAssign, 1);
  });
});
