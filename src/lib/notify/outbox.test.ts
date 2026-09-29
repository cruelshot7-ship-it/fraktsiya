import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { enqueueEvent, flushOutbox, pendingCount, type OutboxEvent } from "./outbox.ts";

describe("notify outbox", () => {
  it("keeps event when delivery fails, marks sent when ok", async () => {
    let list: OutboxEvent[] = [];
    list = enqueueEvent(list, {
      id: "e1",
      kind: "booking_confirmed",
      telegramId: "1",
      payload: { bookingId: "b1" },
    });
    assert.equal(pendingCount(list), 1);
    list = await flushOutbox(list, async () => ({ ok: false, error: "bot_down" }));
    assert.equal(list[0].status, "pending");
    assert.equal(list[0].attempts, 1);
    list = await flushOutbox(list, async () => ({ ok: true }));
    assert.equal(list[0].status, "sent");
  });

  it("marks failed after max attempts", async () => {
    let list: OutboxEvent[] = enqueueEvent([], {
      id: "e2",
      kind: "generic",
      telegramId: "2",
      payload: {},
    });
    for (let i = 0; i < 6; i++) {
      list = await flushOutbox(list, async () => ({ ok: false, error: "x" }));
    }
    assert.equal(list[0].status, "failed");
  });
});
