import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  suggestProgression,
  DEFAULT_PROGRESSION_CONFIG,
  type SessionResultInput,
} from "./engine.ts";

function set(
  exercise: string,
  load: number,
  reps: number,
  opts?: Partial<{
    targetRepsMin: number;
    targetRepsMax: number;
    setsCompleted: number;
    setsPlanned: number;
    unit: "kg" | "lb" | "bw";
  }>,
) {
  return {
    exercise,
    load,
    unit: opts?.unit ?? ("kg" as const),
    reps,
    targetRepsMin: opts?.targetRepsMin ?? 6,
    targetRepsMax: opts?.targetRepsMax ?? 8,
    setsCompleted: opts?.setsCompleted ?? 3,
    setsPlanned: opts?.setsPlanned ?? 3,
  };
}

function session(id: string, day: string, sets: ReturnType<typeof set>[]): SessionResultInput {
  return { id, recordedAt: `${day}T12:00:00.000Z`, sets };
}

describe("suggestProgression", () => {
  it("returns insufficient_data when fewer than minSessions", () => {
    const out = suggestProgression([
      session("r1", "2026-09-01", [set("Присед", 100, 8)]),
    ]);
    assert.equal(out.status, "insufficient_data");
    assert.equal(out.proposedChanges.length, 0);
    assert.match(out.explanation, /Недостаточно данных/i);
  });

  it("proposes +2.5 kg after two top-of-range hits", () => {
    const out = suggestProgression(
      [
        session("r1", "2026-09-01", [set("Присед", 100, 8)]),
        session("r2", "2026-09-04", [set("Присед", 100, 8)]),
      ],
      DEFAULT_PROGRESSION_CONFIG,
    );
    assert.equal(out.status, "pending");
    assert.equal(out.proposedChanges.length, 1);
    assert.equal(out.proposedChanges[0].exercise, "Присед");
    assert.equal(out.proposedChanges[0].fromLoad, 100);
    assert.equal(out.proposedChanges[0].toLoad, 102.5);
    assert.match(out.explanation, /100/);
    assert.deepEqual(out.basedOnResultIds, ["r1", "r2"]);
  });

  it("does not propose when reps stay below target max", () => {
    const out = suggestProgression([
      session("r1", "2026-09-01", [set("Жим", 60, 6)]),
      session("r2", "2026-09-04", [set("Жим", 60, 7)]),
    ]);
    assert.equal(out.status, "insufficient_data");
    assert.equal(out.proposedChanges.length, 0);
  });

  it("does not invent load for bodyweight movements", () => {
    const out = suggestProgression([
      session("r1", "2026-09-01", [set("Подтягивания", 0, 10, { unit: "bw", targetRepsMax: 10 })]),
      session("r2", "2026-09-04", [set("Подтягивания", 0, 10, { unit: "bw", targetRepsMax: 10 })]),
    ]);
    assert.equal(out.proposedChanges.length, 0);
    assert.equal(out.status, "insufficient_data");
  });

  it("ignores incomplete set volume", () => {
    const out = suggestProgression([
      session("r1", "2026-09-01", [set("Тяга", 120, 8, { setsCompleted: 2, setsPlanned: 3 })]),
      session("r2", "2026-09-04", [set("Тяга", 120, 8)]),
    ]);
    assert.equal(out.proposedChanges.length, 0);
  });
});
