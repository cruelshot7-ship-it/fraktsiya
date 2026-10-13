import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canDecideProgression, canSuggestProgression } from "./stage1-rules.ts";

describe("canDecideProgression", () => {
  it("only owning trainer", () => {
    assert.equal(canDecideProgression("trainer", "coach_a", "coach_a"), true);
    assert.equal(canDecideProgression("trainer", "coach_b", "coach_a"), false);
    assert.equal(canDecideProgression("client", "user_x", "coach_a"), false);
  });
});

describe("canSuggestProgression", () => {
  it("главный тренер может по любому тренеру", () => {
    assert.equal(canSuggestProgression({ isMainTrainer: true, actorId: "1", requestedCoachId: "2", coachActive: false }), true);
  });
  it("добавленный тренер — только по себе и с действующим доступом", () => {
    assert.equal(canSuggestProgression({ isMainTrainer: false, actorId: "2", requestedCoachId: "2", coachActive: true }), true);
    assert.equal(canSuggestProgression({ isMainTrainer: false, actorId: "2", requestedCoachId: "3", coachActive: true }), false);
    assert.equal(canSuggestProgression({ isMainTrainer: false, actorId: "2", requestedCoachId: "2", coachActive: false }), false);
  });
  it("клиент, подставивший свой id как coachId, не проходит", () => {
    assert.equal(canSuggestProgression({ isMainTrainer: false, actorId: "9", requestedCoachId: "9", coachActive: false }), false);
  });
});
