import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapsAppLinks, mapsRouteUrl } from "./maps-link.ts";

describe("mapsRouteUrl", () => {
  it("builds yandex route without origin (no geolocation)", () => {
    const url = mapsRouteUrl("Минск, ул. Примерная 1");
    assert.ok(url.includes("yandex.ru/maps"));
    assert.ok(url.includes(encodeURIComponent("Минск, ул. Примерная 1")));
  });

  it("builds google destination link", () => {
    const url = mapsRouteUrl("Hall A", "google");
    assert.ok(url.includes("google.com/maps"));
    assert.ok(url.includes("destination="));
  });

  it("empty destination → empty url", () => {
    assert.equal(mapsRouteUrl("  "), "");
  });

  it("address buttons: yandex and google, each a route to the address", () => {
    const links = mapsAppLinks("Гродно, Лидская 1");
    assert.deepEqual(links.map((l) => l.label), ["Яндекс Карты", "Google Maps"]);
    assert.ok(links[0].url.startsWith("https://yandex.ru/maps/"));
    assert.ok(links[1].url.includes("destination="));
    assert.ok(links.every((l) => l.url.includes(encodeURIComponent("Гродно, Лидская 1"))));
  });

  it("no address → no buttons", () => {
    assert.deepEqual(mapsAppLinks("   "), []);
  });
});
