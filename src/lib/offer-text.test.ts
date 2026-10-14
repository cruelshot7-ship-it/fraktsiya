import { test } from "node:test";
import assert from "node:assert/strict";
import { OFFER_REQUISITES, buildOfferSections, offerReady } from "./offer-text";

const KEYS = Object.keys(OFFER_REQUISITES) as (keyof typeof OFFER_REQUISITES)[];

test("оферта не показывается, пока не заполнены все реквизиты", () => {
  assert.equal(offerReady(), false);
  for (const k of KEYS) OFFER_REQUISITES[k] = "x";
  assert.equal(offerReady(), true);
  for (const k of KEYS) OFFER_REQUISITES[k] = null;
});

test("при заполненных реквизитах текст без пустых полей и служебных пометок", () => {
  const saved = { ...OFFER_REQUISITES };
  OFFER_REQUISITES.address = "г. Гродно, ул. Тестовая, 1";
  OFFER_REQUISITES.bank = "Тестовый банк, р/с BY00TEST00000000000000000000";
  OFFER_REQUISITES.tariffs = "в разделе «Тарифы» приложения";
  OFFER_REQUISITES.payments = "банковская карта";
  try {
    const text = buildOfferSections().flatMap((s) => [s.title, ...s.body]).join("\n");
    assert.doesNotMatch(text, /null|undefined|\[|проверить/);
    assert.match(text, /УНП 591034938/);
  } finally {
    Object.assign(OFFER_REQUISITES, saved);
  }
});
