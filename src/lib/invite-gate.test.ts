import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { initialInviteGate, resolvedInviteGate } from "./invite-gate.ts";

describe("invite gate", () => {
  it("no telegram user or trainer: nothing to wait for, no landing", () => {
    assert.deepEqual(initialInviteGate({ telegramUser: false, trainer: false }), { inviteBlocked: false, inviteChecked: true });
    assert.deepEqual(initialInviteGate({ telegramUser: true, trainer: true }), { inviteBlocked: false, inviteChecked: true });
  });

  it("telegram client before the server answers: neither landing nor booking yet", () => {
    assert.deepEqual(initialInviteGate({ telegramUser: true, trainer: false }), { inviteBlocked: true, inviteChecked: false });
  });

  it("existing client: server answers not blocked → no landing, goes straight in", () => {
    assert.deepEqual(resolvedInviteGate({ blocked: false, clientCount: 1 }), { inviteBlocked: false, inviteChecked: true });
    assert.deepEqual(resolvedInviteGate({ blocked: undefined, clientCount: 1 }), { inviteBlocked: false, inviteChecked: true });
  });

  it("guest: server says blocked and no clients → landing stays", () => {
    assert.deepEqual(resolvedInviteGate({ blocked: true, clientCount: 0 }), { inviteBlocked: true, inviteChecked: true });
  });

  it("blocked flag but clients exist → not a guest", () => {
    assert.deepEqual(resolvedInviteGate({ blocked: true, clientCount: 2 }), { inviteBlocked: false, inviteChecked: true });
  });
});
