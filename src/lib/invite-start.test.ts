import { test } from "node:test";
import assert from "node:assert/strict";
import { coachTokenFromStart } from "./invite-start.ts";

test("client link c_<id> and trainer QR link coach_<id> both give the token", () => {
  assert.equal(coachTokenFromStart("c_1000"), "1000");
  assert.equal(coachTokenFromStart("coach_1000"), "1000");
  assert.equal(coachTokenFromStart("coach_abc12"), "abc12");
});

test("no link, a machine sticker or an unknown prefix gives null", () => {
  assert.equal(coachTokenFromStart(""), null);
  assert.equal(coachTokenFromStart("m_3"), null);
  assert.equal(coachTokenFromStart("r_ref1"), null);
  assert.equal(coachTokenFromStart("coach_x; drop"), null);
});
