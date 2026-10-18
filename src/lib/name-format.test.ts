import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shortName } from "./name-format.ts";

describe("shortName", () => {
  it("first name and initial of the last name", () => {
    assert.equal(shortName({ firstName: "Даник", lastName: "Петров" }), "Даник П.");
  });

  it("wide and non-breaking spaces do not make a gap", () => {
    assert.equal(shortName({ firstName: "Даник  ", lastName: "П." }), "Даник П.");
  });

  it("zero-width characters are removed", () => {
    assert.equal(shortName({ firstName: "Да​ник", lastName: "П" }), "Даник П.");
  });

  it("no last name → first name only", () => {
    assert.equal(shortName({ firstName: "  Катя ", lastName: "" }), "Катя");
    assert.equal(shortName({ firstName: "Катя", lastName: null }), "Катя");
  });
});
