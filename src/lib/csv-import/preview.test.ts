import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsvPreview, suggestColumnMap } from "./preview.ts";

describe("parseCsvPreview", () => {
  it("parses header and rows", () => {
    const r = parseCsvPreview("Имя,Telegram\nАнна,@anna\nБорис,@boris");
    assert.deepEqual(r.headers, ["Имя", "Telegram"]);
    assert.equal(r.rowCount, 2);
    assert.equal(r.rows[0]["Имя"], "Анна");
  });

  it("reports column mismatch", () => {
    const r = parseCsvPreview("a,b\n1,2,3");
    assert.ok(r.errors.some((e) => e.includes("колонок")));
  });

  it("empty file error", () => {
    const r = parseCsvPreview("");
    assert.ok(r.errors.length);
  });
});

describe("suggestColumnMap", () => {
  it("maps common headers", () => {
    const m = suggestColumnMap(["Имя клиента", "Telegram", "Note"]);
    assert.equal(m["Имя клиента"], "firstName");
    assert.equal(m["Telegram"], "telegram");
  });
});
