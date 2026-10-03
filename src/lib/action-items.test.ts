import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clientActionItems, trainerActionItems } from "./action-items.ts";

type Client = { id: string; firstName: string; [k: string]: unknown };
type Booking = {
  id: string;
  clientId: string;
  date: string;
  time: string;
  duration: number;
  checkedIn?: boolean;
  noShow?: boolean;
  slotId?: string;
};

function client(partial: Partial<Client> & { id: string; firstName: string }): Client {
  return {
    telegramId: "",
    sessionsLeft: 4,
    streak: 0,
    programTitle: "База",
    programWeeks: 4,
    sessions: [],
    trainDays: [1, 3, 5],
    trainTimes: ["19:00"],
    ...partial,
  };
}

function booking(
  partial: Partial<Booking> & { id: string; clientId: string; date: string; time: string },
): Booking {
  return {
    slotId: `${partial.date}_${partial.time}`,
    duration: 60,
    checkedIn: false,
    noShow: false,
    ...partial,
  };
}

describe("clientActionItems", () => {
  it("surfaces next session when booked", () => {
    const c = client({ id: "c1", firstName: "Анна" });
    const future = "2099-06-01";
    const items = clientActionItems({
      client: c,
      bookings: [booking({ id: "b1", clientId: "c1", date: future, time: "19:00" })],
      slots: [],
      notices: [],
    });
    assert.ok(items.some((i) => i.kind === "next_session"));
    assert.equal(items.find((i) => i.kind === "next_session")?.bookingId, "b1");
  });

  it("offers soft return after long gap", () => {
    const c = client({ id: "c1", firstName: "Анна" });
    const items = clientActionItems({
      client: c,
      bookings: [booking({ id: "b1", clientId: "c1", date: "2020-01-01", time: "19:00", checkedIn: true })],
      slots: [],
      notices: [],
    });
    assert.ok(items.some((i) => i.kind === "return_soft" || i.kind === "book_next"));
  });
});

describe("trainerActionItems", () => {
  it("lists clients without upcoming booking", () => {
    const clients = [client({ id: "c1", firstName: "А" }), client({ id: "c2", firstName: "Б" })];
    const items = trainerActionItems({
      clients,
      bookings: [],
      slots: [],
      notices: [],
      joinPendingCount: 0,
    });
    assert.ok(items.some((i) => i.kind === "client_without_booking"));
  });

  it("surfaces pending joins", () => {
    const items = trainerActionItems({
      clients: [],
      bookings: [],
      slots: [],
      notices: [],
      joinPendingCount: 2,
    });
    assert.ok(items.some((i) => i.kind === "pending_join"));
  });
});
