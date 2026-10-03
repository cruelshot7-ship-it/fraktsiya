import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendHistory, historyForClient } from "./program-history.ts";

describe("program history", () => {
  it("prepends and filters by client", () => {
    let list = appendHistory([], {
      clientId: "c1",
      kind: "template",
      title: "Шаблон",
      body: "База",
    });
    list = appendHistory(list, {
      clientId: "c2",
      kind: "manual",
      title: "Правка",
      body: "x",
    });
    assert.equal(historyForClient(list, "c1").length, 1);
    assert.equal(historyForClient(list, "c1")[0].title, "Шаблон");
  });
});
