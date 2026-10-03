import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rowsToClientDrafts } from "./apply-local.ts";

describe("rowsToClientDrafts", () => {
  it("maps rows via column map", () => {
    const { drafts, skipped } = rowsToClientDrafts(
      [
        { Имя: "Анна", Telegram: "@anna" },
        { Имя: "", Telegram: "@x" },
      ],
      { Имя: "firstName", Telegram: "telegram" },
    );
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0]!.firstName, "Анна");
    assert.equal(drafts[0]!.telegramUsername, "@anna");
    assert.equal(skipped, 1);
  });
});
