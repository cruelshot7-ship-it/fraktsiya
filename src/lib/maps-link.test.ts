import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isVenueAddress, mapPlatform, normalizeAddress, routeUrl, type Venue } from "./maps-link.ts";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15";

const VENUE: Venue = {
  name: "Titan",
  address: "Гродно, улица Лидская, 1",
  yandexOrgUrl: "https://yandex.ru/maps/org/198928680684",
};

describe("mapPlatform", () => {
  it("iPhone and iPad → ios", () => {
    assert.equal(mapPlatform(IPHONE), "ios");
    assert.equal(mapPlatform("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)"), "ios");
  });

  it("Android → android, everything else → other", () => {
    assert.equal(mapPlatform(ANDROID), "android");
    assert.equal(mapPlatform(DESKTOP), "other");
    assert.equal(mapPlatform(""), "other");
  });
});

describe("normalizeAddress", () => {
  it("both spellings of the venue address are the same address", () => {
    assert.equal(normalizeAddress("Гродно, Лидская 1"), normalizeAddress("Гродно, улица Лидская, 1"));
    assert.equal(normalizeAddress("г. Гродно, ул. Лидская, 1"), "гродно лидская 1");
  });

  it("is case and ё insensitive", () => {
    assert.equal(normalizeAddress("ГРОДНО, Лидская Ё"), normalizeAddress("гродно, лидская е"));
  });

  it("other addresses stay different", () => {
    assert.notEqual(normalizeAddress("Гродно, Лидская 2"), normalizeAddress("Гродно, Лидская 1"));
  });
});

describe("isVenueAddress", () => {
  it("matches the venue in any spelling", () => {
    assert.equal(isVenueAddress("Гродно, Лидская 1", VENUE), true);
    assert.equal(isVenueAddress("Гродно, Минская 5", VENUE), false);
    assert.equal(isVenueAddress("   ", VENUE), false);
  });
});

describe("routeUrl", () => {
  it("empty address → no link", () => {
    assert.equal(routeUrl("   ", "ios", VENUE), "");
  });

  it("iPhone opens Apple Maps with the address", () => {
    const url = routeUrl("Минск, ул. Примерная 1", "ios");
    assert.ok(url.startsWith("https://maps.apple.com/?"));
    assert.ok(url.includes(`daddr=${encodeURIComponent("Минск, ул. Примерная 1")}`));
  });

  it("Android opens Google Maps directions", () => {
    const url = routeUrl("Минск, ул. Примерная 1", "android");
    assert.ok(url.startsWith("https://www.google.com/maps/dir/?api=1&destination="));
  });

  it("other devices open Yandex Maps route without geolocation", () => {
    const url = routeUrl("Минск, ул. Примерная 1", "other");
    assert.ok(url.startsWith("https://yandex.ru/maps/?rtext=~"));
    assert.ok(url.includes(encodeURIComponent("Минск, ул. Примерная 1")));
  });

  it("venue on other devices opens the Yandex card", () => {
    assert.equal(routeUrl("Гродно, Лидская 1", "other", VENUE), VENUE.yandexOrgUrl);
  });

  it("venue on iPhone and Android uses the canonical venue address", () => {
    const ios = routeUrl("Гродно, Лидская 1", "ios", VENUE);
    const android = routeUrl("Гродно, Лидская 1", "android", VENUE);
    assert.ok(ios.includes(encodeURIComponent(VENUE.address)));
    assert.ok(android.includes(encodeURIComponent(VENUE.address)));
    assert.ok(!ios.includes(encodeURIComponent(VENUE.name)));
  });

  it("venue with coordinates routes to the point on iPhone and Android", () => {
    const withPoint: Venue = { ...VENUE, coords: { lat: 53.67432, lon: 23.852 } };
    assert.equal(routeUrl("Гродно, Лидская 1", "ios", withPoint), "https://maps.apple.com/?daddr=53.67432,23.852&dirflg=d");
    assert.equal(routeUrl("Гродно, Лидская 1", "android", withPoint), "https://www.google.com/maps/dir/?api=1&destination=53.67432,23.852");
  });
});
