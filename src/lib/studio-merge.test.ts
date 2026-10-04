import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DISMISSED_CAP,
  mergeBookingFlags,
  ownDismissed,
  unionIds,
} from "./studio-merge.ts";

describe("mergeBookingFlags", () => {
  it("trainer flags survive stale client row", () => {
    const prev = { id: "b1", confirmed: true, checkedIn: true, noShow: false };
    const stale = { id: "b1", confirmed: false, checkedIn: false, noShow: false };
    const merged = mergeBookingFlags(stale, prev);
    assert.equal(merged.confirmed, true);
    assert.equal(merged.checkedIn, true);
    assert.equal(merged.noShow, false);
  });

  it("client can set noShow true over false", () => {
    const prev = { id: "b1", noShow: false };
    const row = { id: "b1", noShow: true };
    assert.equal(mergeBookingFlags(row, prev).noShow, true);
  });
});

describe("ownDismissed", () => {
  it("client cannot dismiss someone else's notice", () => {
    const notices = [
      { id: "n1", clientId: "me" },
      { id: "n2", clientId: "other" },
    ];
    const out = ownDismissed([], ["n1", "n2"], notices, "me");
    assert.deepEqual(out, ["n1"]);
  });

  it("keeps prior dismissals and unions own", () => {
    const notices = [{ id: "n1", clientId: "me" }];
    const out = ownDismissed(["old"], ["n1"], notices, "me");
    assert.ok(out.includes("old"));
    assert.ok(out.includes("n1"));
  });
});

describe("unionIds", () => {
  it("dedupes", () => {
    assert.deepEqual(unionIds(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  });

  it("caps at DISMISSED_CAP keeping newest tail", () => {
    const a = Array.from({ length: 400 }, (_, i) => `a${i}`);
    const b = Array.from({ length: 200 }, (_, i) => `b${i}`);
    const out = unionIds(a, b);
    assert.equal(out.length, DISMISSED_CAP);
    assert.equal(out[out.length - 1], "b199");
  });
});
