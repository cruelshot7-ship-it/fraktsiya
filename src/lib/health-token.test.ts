import { strict as assert } from "node:assert";
import { test } from "node:test";
import { newHealthToken, pickHealthToken } from "./health-token.ts";

test("новый токен — 32 символа hex и каждый раз разный", () => {
  const a = newHealthToken();
  const b = newHealthToken();
  assert.match(a, /^[a-f0-9]{32}$/);
  assert.notEqual(a, b);
});

test("свой уже выданный токен сохраняется", () => {
  const own = "abcdef0123456789abcdef0123456789";
  assert.equal(pickHealthToken({ own, proposed: "ffffffffffffffffffffffffffffffff", usedByOthers: new Set() }), own);
});

test("присланный клиентом токен принимается, если он свободен", () => {
  const proposed = "1234567890abcdef1234567890abcdef";
  assert.equal(pickHealthToken({ own: null, proposed, usedByOthers: new Set() }), proposed);
});

test("чужой или некорректный токен заменяется новым", () => {
  const taken = "1234567890abcdef1234567890abcdef";
  const picked = pickHealthToken({ own: null, proposed: taken, usedByOthers: new Set([taken]) });
  assert.notEqual(picked, taken);
  assert.match(picked, /^[a-f0-9]{32}$/);
  const bad = pickHealthToken({ own: null, proposed: "короткий", usedByOthers: new Set() });
  assert.match(bad, /^[a-f0-9]{32}$/);
});
