import { strict as assert } from "node:assert";
import { test } from "node:test";
import { anonymizedIdentity, needsConsent, PRIVACY_VERSION, stampConsent } from "./privacy.ts";

test("needsConsent: missing, old version or unstamped means consent is required", () => {
  assert.equal(needsConsent(null), true);
  assert.equal(needsConsent(undefined), true);
  assert.equal(needsConsent({ version: "2020-01-01", acceptedAt: "2020-01-01T00:00:00Z" }), true);
  assert.equal(needsConsent({ version: PRIVACY_VERSION, acceptedAt: null }), true);
  assert.equal(needsConsent({ version: PRIVACY_VERSION, acceptedAt: "2026-10-10T10:00:00Z" }), false);
});

test("stampConsent: server time is written for a new acceptance and never overwritten", () => {
  const now = "2026-10-10T07:00:00.000Z";
  const first = stampConsent(null, { version: PRIVACY_VERSION, acceptedAt: "1999-01-01T00:00:00Z" }, now);
  assert.deepEqual(first, { version: PRIVACY_VERSION, acceptedAt: now });
  const later = stampConsent(first, { version: PRIVACY_VERSION, acceptedAt: "2030-01-01T00:00:00Z" }, "2031-01-01T00:00:00.000Z");
  assert.deepEqual(later, first);
});

test("stampConsent: a client cannot accept an old version or write consent without one", () => {
  const now = "2026-10-10T07:00:00.000Z";
  assert.equal(stampConsent(null, { version: "old", acceptedAt: now }, now), null);
  assert.equal(stampConsent(null, null, now), null);
});

test("anonymizedIdentity removes every direct identifier", () => {
  const row = anonymizedIdentity();
  assert.equal(row.phone, null);
  assert.equal(row.telegramId, null);
  assert.equal(row.telegramUsername, null);
  assert.equal(row.healthToken, null);
  assert.notEqual(row.firstName, "Евгений");
});
