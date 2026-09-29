import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findDuplicates } from "./duplicates.ts";

describe("findDuplicates", () => {
  it("detects by phone and username", () => {
    const hits = findDuplicates(
      [
        { firstName: "Анна", lastName: "И", phone: "89991234567" },
        { firstName: "Борис", lastName: "К", telegramUsername: "@boris" },
        { firstName: "Новый", lastName: "Клиент" },
      ],
      [
        { firstName: "А", lastName: "И", phone: "79991234567" },
        { firstName: "Б", lastName: "К", telegramUsername: "boris" },
      ],
    );
    assert.equal(hits.length, 2);
    assert.ok(hits.some((h) => h.draftIndex === 0));
    assert.ok(hits.some((h) => h.draftIndex === 1));
  });
});
