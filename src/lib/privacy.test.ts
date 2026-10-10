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

test("consent log records a new acceptance once, with the server time", async () => {
  const { consentLogAfter, PRIVACY_VERSION } = await import("./privacy.ts");
  const now = "2026-10-10T08:00:00.000Z";
  const first = consentLogAfter({ consent: null, consentLog: [] }, { version: PRIVACY_VERSION, acceptedAt: "client-clock" }, now);
  assert.deepEqual(first, [{ version: PRIVACY_VERSION, at: now, action: "accept" }]);
  const again = consentLogAfter(
    { consent: { version: PRIVACY_VERSION, acceptedAt: now }, consentLog: first },
    { version: PRIVACY_VERSION, acceptedAt: "again" },
    "2026-10-11T08:00:00.000Z",
  );
  assert.equal(again?.length, 1, "a repeat of the same version is not logged");
});

test("consent log keeps earlier versions when the policy is bumped", async () => {
  const { consentLogAfter, appendConsentLog } = await import("./privacy.ts");
  const old = [{ version: "2026-01-01", at: "2026-01-02T00:00:00.000Z", action: "accept" as const }];
  const next = consentLogAfter({ consent: { version: "2026-01-01", acceptedAt: "x" }, consentLog: old }, { version: "2026-10-10", acceptedAt: "y" }, "2026-10-10T09:00:00.000Z");
  assert.equal(next?.length, 2);
  assert.equal(next?.[0].version, "2026-01-01");
  assert.equal(appendConsentLog(undefined, { version: "v", at: "t", action: "erase" }).length, 1);
});

test("erasure notice to the trainer carries no name and no phone", async () => {
  const { erasureNotice } = await import("./privacy.ts");
  const n = erasureNotice("c9", "2026-10-10T09:00:00.000Z");
  assert.equal(n.audience, "trainer");
  assert.equal(n.clientId, "c9");
  assert.ok(!/\+?\d{6,}/.test(n.body));
});

test("stampConsent: a payload without acceptedAt never grants consent", () => {
  const now = "2026-10-10T07:00:00.000Z";
  assert.equal(stampConsent(null, { version: PRIVACY_VERSION, acceptedAt: null }, now), null);
});

test("stampConsent: a refusal is stamped with server time once and not overwritten", () => {
  const first = stampConsent(null, { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "client" }, "2026-10-10T07:00:00.000Z");
  assert.deepEqual(first, { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "2026-10-10T07:00:00.000Z" });
  const again = stampConsent(first, { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "x" }, "2026-10-11T07:00:00.000Z");
  assert.deepEqual(again, first);
  assert.equal(needsConsent(first), true, "a refusal does not count as consent");
});

test("stampConsent: a later acceptance replaces the refusal", () => {
  const declined = { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "2026-10-10T07:00:00.000Z" };
  const accepted = stampConsent(declined, { version: PRIVACY_VERSION, acceptedAt: "client" }, "2026-10-11T08:00:00.000Z");
  assert.deepEqual(accepted, { version: PRIVACY_VERSION, acceptedAt: "2026-10-11T08:00:00.000Z" });
});

test("stampConsent: a refusal sent after acceptance does not revoke it", () => {
  const accepted = { version: PRIVACY_VERSION, acceptedAt: "2026-10-10T07:00:00.000Z" };
  assert.deepEqual(stampConsent(accepted, { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "x" }, "2026-10-11T00:00:00.000Z"), accepted);
});

test("consent log: a refusal is logged once with server time", async () => {
  const { consentLogAfter } = await import("./privacy.ts");
  const now = "2026-10-10T09:00:00.000Z";
  const first = consentLogAfter({ consent: null, consentLog: [] }, { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "client" }, now);
  assert.deepEqual(first, [{ version: PRIVACY_VERSION, at: now, action: "decline" }]);
  const repeat = consentLogAfter(
    { consent: { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: now }, consentLog: first },
    { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "again" },
    "2026-10-10T10:00:00.000Z",
  );
  assert.equal(repeat?.length, 1, "a repeated refusal is not logged again");
});

test("consent log: refusal then acceptance keeps both events in order", async () => {
  const { consentLogAfter } = await import("./privacy.ts");
  const declinedLog = [{ version: PRIVACY_VERSION, at: "2026-10-10T09:00:00.000Z", action: "decline" as const }];
  const log = consentLogAfter(
    { consent: { version: PRIVACY_VERSION, acceptedAt: null, declinedAt: "2026-10-10T09:00:00.000Z" }, consentLog: declinedLog },
    { version: PRIVACY_VERSION, acceptedAt: "client" },
    "2026-10-11T09:00:00.000Z",
  );
  assert.deepEqual(
    log?.map((e) => e.action),
    ["decline", "accept"],
  );
});
