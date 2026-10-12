import assert from "node:assert/strict";
import test from "node:test";
import { keepClientOwned } from "./client-owned.ts";
import { PRIVACY_VERSION } from "./privacy.ts";
import type { Client } from "@/data/studio";

const base = {
  id: "c1",
  consent: null,
  consentLog: [],
  measures: [],
  erasedAt: null,
  lastReportAt: null,
  streak: 0,
} as unknown as Client;

test("keepClientOwned: новый клиент от тренера не получает согласие из присланной копии", () => {
  const sent = { ...base, consent: { version: PRIVACY_VERSION, acceptedAt: "2026-10-12T10:00:00Z" } } as Client;
  const result = keepClientOwned(undefined, sent);
  assert.equal(result.consent, null, "согласие ставит только сам клиент");
  assert.deepEqual(result.consentLog, []);
});

test("keepClientOwned: у существующего клиента согласие берётся с сервера", () => {
  const server = { ...base, consent: { version: PRIVACY_VERSION, acceptedAt: "2026-10-11T10:00:00Z" } } as Client;
  const sent = { ...base, consent: null } as Client;
  assert.equal(keepClientOwned(server, sent).consent?.acceptedAt, "2026-10-11T10:00:00Z");
});
