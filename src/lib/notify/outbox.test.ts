import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyDeliveryResults, enqueueEvent, flushOutbox, pendingCount, type OutboxEvent } from "./outbox.ts";

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

describe("applyDeliveryResults", () => {
  it("changes only what the server confirmed and never resends sent events", () => {
    let list: OutboxEvent[] = [];
    list = enqueueEvent(list, { id: "a", kind: "booking_confirmed", telegramId: "1", payload: {} });
    list = enqueueEvent(list, { id: "b", kind: "booking_confirmed", telegramId: "1", payload: {} });
    list = enqueueEvent(list, { id: "c", kind: "booking_confirmed", telegramId: "1", payload: {} });
    list = applyDeliveryResults(list, [
      { id: "a", ok: true },
      { id: "b", ok: false, error: "bot_down" },
    ]);
    assert.equal(list[0].status, "sent");
    assert.equal(list[1].status, "pending");
    assert.equal(list[1].lastError, "bot_down");
    assert.equal(list[2].status, "pending", "событие без ответа остаётся в очереди");
    assert.equal(list[2].attempts, 0);

    // повторный ответ не переводит отправленное обратно и не добавляет попыток
    const again = applyDeliveryResults(list, [{ id: "a", ok: false, error: "x" }]);
    assert.equal(again[0].status, "sent");
    assert.equal(again[0].attempts, 1);
  });

  it("marks failed after max attempts", () => {
    let list: OutboxEvent[] = enqueueEvent([], { id: "d", kind: "generic", telegramId: "1", payload: {} });
    for (let i = 0; i < 5; i++) list = applyDeliveryResults(list, [{ id: "d", ok: false, error: "e" }]);
    assert.equal(list[0].status, "failed");
  });
});
