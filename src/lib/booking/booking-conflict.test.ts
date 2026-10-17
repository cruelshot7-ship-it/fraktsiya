import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookConflictText, releasesLocalBooking } from "./booking-conflict.ts";

describe("booking conflict", () => {
  it("full slot releases the unconfirmed local booking", () => {
    assert.equal(releasesLocalBooking("full"), true);
    assert.match(bookConflictText("full"), /заняли/);
  });

  it("already booked keeps the booking, the server has it", () => {
    assert.equal(releasesLocalBooking("already-booked"), false);
    assert.match(bookConflictText("already-booked"), /уже есть на сервере/);
  });
});
