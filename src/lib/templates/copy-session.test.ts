import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendCopiedSession, copySessionAsNew } from "./copy-session.ts";

describe("copy session", () => {
  it("copies items independently", () => {
    const src = { id: "d1", name: "День A", focus: "ноги", items: ["Присед 3×5"] };
    const c = copySessionAsNew(src, { id: "d2" });
    c.items.push("extra");
    assert.equal(src.items.length, 1);
    assert.equal(c.name.includes("копия"), true);
  });

  it("appends to list", () => {
    const list = [{ id: "d1", name: "A", focus: "x", items: ["1"] }];
    const next = appendCopiedSession(list, "d1");
    assert.equal(next?.length, 2);
    assert.equal(list.length, 1);
  });
});
