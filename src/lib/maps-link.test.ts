import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mapsRouteUrl } from "./maps-link.ts";

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
});
