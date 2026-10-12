import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Client } from "@/data/studio";
import {
  newReferralCode,
  referralCodeFromStart,
  referralRewarded,
  referralRewardTxn,
  referralStart,
  referrerByCode,
  REFERRAL_REWARD,
} from "./referral.ts";

const CODE = "0123456789ab";
const client = (over: Partial<Client>) => ({ id: "c1", ledger: [], txnIds: [], referralCode: CODE, ...over }) as Client;

test("код — 12 hex-символов и каждый раз новый", () => {
  const a = newReferralCode();
  assert.match(a, /^[a-f0-9]{12}$/);
  assert.notEqual(a, newReferralCode());
});

test("ссылка r_<код> разбирается обратно; чужой параметр — null", () => {
  assert.equal(referralCodeFromStart(referralStart(CODE)), CODE);
  assert.equal(referralCodeFromStart("R_" + CODE.toUpperCase()), CODE);
  assert.equal(referralCodeFromStart("c_8144320404"), null);
  assert.equal(referralCodeFromStart("r_короткий"), null);
  assert.equal(referralCodeFromStart(""), null);
});

test("пригласивший находится по коду; неверный код никого не находит", () => {
  const clients = [client({ id: "a", referralCode: CODE }), client({ id: "b", referralCode: "ffffffffffff" })];
  assert.equal(referrerByCode(CODE, clients)?.id, "a");
  assert.equal(referrerByCode("000000000000", clients), undefined);
  assert.equal(referrerByCode("bad", clients), undefined);
});

test("награда — одно занятие с id ref_<приглашённый>", () => {
  const txn = referralRewardTxn("a", "b", "2026-10-12T10:00:00.000Z");
  assert.equal(txn.id, "ref_b");
  assert.equal(txn.clientId, "a");
  assert.equal(txn.delta, REFERRAL_REWARD);
  assert.equal(txn.kind, "credit");
});

test("повторная награда распознаётся по журналу и по учтённым событиям", () => {
  assert.equal(referralRewarded("b", client({})), false);
  assert.equal(referralRewarded("b", client({ ledger: [referralRewardTxn("a", "b", "x")] })), true);
  assert.equal(referralRewarded("b", client({ txnIds: ["ref_b"] })), true);
  assert.equal(referralRewarded("c", client({ txnIds: ["ref_b"] })), false);
});
