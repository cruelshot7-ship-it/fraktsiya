import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cancelTxnId, settleOwned, type Snapshot } from "./balance.ts";
import { isLateCancelAt, slotStartMs } from "./minsk-time.ts";

type C = Snapshot["clients"][number];
type B = Snapshot["bookings"][number];
type T = C["ledger"][number];

const NOW = Date.parse("2026-10-10T10:00:00+03:00");
const RULE = { flagLate: true, windowHours: 2 };

function client(over: Partial<C> = {}): C {
  return { id: "c1", sessionsLeft: 4, ledger: [], lateCancels: 0, ...over } as C;
}
function booking(over: Partial<B> = {}): B {
  return { id: "bk_s1_c1", slotId: "2026-10-12_19:00", clientId: "c1", date: "2026-10-12", time: "19:00", duration: 60, held: true, holdId: "tx_hold_1", ...over } as B;
}
function hold(over: Partial<T> = {}): T {
  return { id: "tx_hold_1", clientId: "c1", kind: "hold", delta: -1, at: "", note: "Запись", bookingId: "bk_s1_c1", ...over };
}
function cancel(kind: "refund" | "burn", b: B, over: Partial<T> = {}): T {
  return { id: cancelTxnId(b), clientId: "c1", kind, delta: kind === "refund" ? 1 : 0, at: "", note: "Отмена", bookingId: b.id, ...over };
}
const snap = (clients: C[], bookings: B[] = []): Snapshot => ({ clients, bookings });
const one = (r: ReturnType<typeof settleOwned>) => r.balances.get("c1")!;
const owners = new Set(["c1"]);

test("Minsk wall-clock: slot time is independent of the host timezone", () => {
  assert.equal(slotStartMs("2026-10-12", "18:00"), Date.parse("2026-10-12T15:00:00Z"));
  assert.equal(isLateCancelAt("2026-10-10", "11:30", NOW, 2), true);
  assert.equal(isLateCancelAt("2026-10-10", "12:00", NOW, 2), false);
});

test("client hold admits booking and takes one session", () => {
  const r = settleOwned(snap([client()]), snap([client({ sessionsLeft: 99 })], [booking()]), owners, "client", RULE, NOW);
  // incoming ledger must carry the hold; sender's sessionsLeft is ignored
  assert.equal(one(r).sessionsLeft, 4);
  const r2 = settleOwned(snap([client()]), snap([client({ ledger: [hold()] })], [booking()]), owners, "client", RULE, NOW);
  assert.equal(one(r2).sessionsLeft, 3);
  assert.equal(r2.bookings.length, 1);
  assert.equal(r2.bookings[0].id, "bk_s1_c1");
  assert.deepEqual(r2.rejected, []);
});

test("hold without a balance is refused and its booking is dropped", () => {
  const r = settleOwned(snap([client({ sessionsLeft: 0 })]), snap([client({ ledger: [hold()] })], [booking()]), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 0);
  assert.equal(r.bookings.length, 0);
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
});

test("a stale copy re-sending an applied hold does not charge twice", () => {
  const applied = client({ sessionsLeft: 3, ledger: [hold()], txnIds: ["tx_hold_1"] });
  const r = settleOwned(snap([applied], [booking()]), snap([client({ ledger: [hold()] })], [booking()]), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 3);
  assert.equal(r.bookings.length, 1);
});

test("early client cancel refunds exactly once, even if re-sent", () => {
  const b = booking({ date: "2026-10-12" });
  const base = client({ sessionsLeft: 3, ledger: [hold()], txnIds: ["tx_hold_1"] });
  const r = settleOwned(snap([base], [b]), snap([client({ ledger: [cancel("refund", b)] })], []), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 4);
  assert.equal(r.bookings.length, 0);
  const again = settleOwned(snap([{ ...base, sessionsLeft: 4, txnIds: [...one(r).txnIds] } as C], []), snap([client({ ledger: [cancel("refund", b)] })], [b]), owners, "client", RULE, NOW);
  assert.equal(one(again).sessionsLeft, 4);
});

test("late client cancel burns the session and counts a late cancel", () => {
  const b = booking({ date: "2026-10-10", time: "11:00" });
  const base = client({ sessionsLeft: 3, txnIds: ["tx_hold_1"] });
  const r = settleOwned(snap([base], [b]), snap([client({ ledger: [cancel("refund", b)] })], []), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 3);
  assert.equal(one(r).lateCancels, 1);
  assert.equal(one(r).ledger[0].kind, "burn");
});

test("the server ignores a client's refund claim for a late cancel", () => {
  const b = booking({ date: "2026-10-10", time: "11:00" });
  const r = settleOwned(snap([client({ sessionsLeft: 3 })], [b]), snap([client({ ledger: [cancel("refund", b)] })], []), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 3, "no free session from a late cancel");
});

test("trainer cancel always refunds, even inside the window", () => {
  const b = booking({ date: "2026-10-10", time: "11:00" });
  const r = settleOwned(snap([client({ sessionsLeft: 3 })], [b]), snap([client({ ledger: [cancel("refund", b)] })], []), owners, "trainer", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 4);
  assert.equal(one(r).lateCancels, 0);
});

test("cancel of a booking that never reached the server is refused", () => {
  const b = booking();
  const r = settleOwned(snap([client({ sessionsLeft: 3 })], []), snap([client({ ledger: [cancel("refund", b)] })], []), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 3);
  assert.deepEqual(r.rejected, [cancelTxnId(b)]);
});

test("rebooking the same slot gets its own hold and cancel", () => {
  const first = booking({ holdId: "tx_hold_1" });
  const base = client({ sessionsLeft: 3, txnIds: ["tx_hold_1", "cancel:tx_hold_1"] });
  const rebook = booking({ holdId: "tx_hold_2" });
  const r = settleOwned(snap([base], []), snap([client({ ledger: [hold({ id: "tx_hold_2" })] })], [rebook]), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 2);
  assert.equal(r.bookings.length, 1);
  assert.notEqual(cancelTxnId(first), cancelTxnId(rebook));
});

test("trainer credit applies once; client cannot credit", () => {
  const credit: T = { id: "tx_cr_1", clientId: "c1", kind: "credit", delta: 4, at: "", note: "Пакет" };
  const t = settleOwned(snap([client({ sessionsLeft: 0 })]), snap([client({ ledger: [credit] })]), owners, "trainer", RULE, NOW);
  assert.equal(one(t).sessionsLeft, 4);
  const t2 = settleOwned(snap([client({ sessionsLeft: 4, txnIds: ["tx_cr_1"] })]), snap([client({ ledger: [credit] })]), owners, "trainer", RULE, NOW);
  assert.equal(one(t2).sessionsLeft, 4);
  const c = settleOwned(snap([client({ sessionsLeft: 0 })]), snap([client({ ledger: [credit] })]), owners, "client", RULE, NOW);
  assert.equal(one(c).sessionsLeft, 0);
});

test("stale client copy does not remove a booking the trainer just made", () => {
  const trainerBooking = booking({ id: "bk_s2_c1", slotId: "2026-10-12_19:00", holdId: "tx_hold_9" });
  const r = settleOwned(snap([client({ sessionsLeft: 2, txnIds: [] })], [trainerBooking]), snap([client()], []), owners, "client", RULE, NOW);
  assert.equal(r.bookings.length, 1);
  assert.equal(one(r).sessionsLeft, 2);
});

test("a client's sessions cannot go negative and an adjust cannot dip below zero", () => {
  const adj: T = { id: "tx_adj", clientId: "c1", kind: "adjust", delta: -9, at: "", note: "Корректировка" };
  const r = settleOwned(snap([client({ sessionsLeft: 2 })]), snap([client({ ledger: [adj] })]), owners, "trainer", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 0);
});

test("rows for other clients are untouched", () => {
  const other = booking({ id: "bk_x_c2", clientId: "c2", holdId: "tx_o" });
  const r = settleOwned(snap([client({ sessionsLeft: 4 })], [other]), snap([client({ ledger: [hold()] })], [booking()]), owners, "client", RULE, NOW);
  assert.ok(r.bookings.some((b) => b.id === "bk_x_c2"));
});

test("legacy ledger entries are never replayed (no double credit on first sync)", () => {
  const credit: T = { id: "tx_cr_old", clientId: "c1", kind: "credit", delta: 4, at: "", note: "Пакет" };
  const legacy = client({ sessionsLeft: 4, ledger: [credit] }); // no txnIds yet
  const r = settleOwned(snap([legacy]), snap([client({ ledger: [credit] })]), owners, "trainer", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 4);
  assert.ok(one(r).txnIds.includes("tx_cr_old"));
});

test("legacy hold in the ledger is not charged again, and its booking is not admitted", () => {
  const legacyHold: T = { id: "tx_hold_old", clientId: "c1", kind: "hold", delta: -1, at: "", note: "Запись", bookingId: "bk_s1_c1" };
  const legacy = client({ sessionsLeft: 3, ledger: [legacyHold] });
  const r = settleOwned(snap([legacy]), snap([client({ ledger: [legacyHold] })], [booking({ holdId: undefined })]), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 3);
  assert.equal(r.bookings.length, 0);
});

test("a booking moved to a later slot is judged by its new time", () => {
  const old = booking({ slotId: "2026-10-10_11:00", date: "2026-10-10", time: "11:00" });
  const moved = booking({ date: "2026-10-12", time: "19:00" });
  const base = client({ sessionsLeft: 3, txnIds: ["tx_hold_1"] });
  const r = settleOwned(snap([base], [old]), snap([client({ ledger: [cancel("refund", old)] })], [moved]), owners, "client", RULE, NOW);
  assert.equal(one(r).sessionsLeft, 4, "not late against the new slot, so a refund");
  assert.equal(one(r).lateCancels, 0);
});

/* ---- capacity, closed and past slots ---- */

const SLOT_DAY = "2026-10-12";
const S8 = "2026-10-12_08:00";
const other = (id: string, clientId: string, over: Partial<B> = {}): B =>
  booking({ id, slotId: S8, clientId, date: SLOT_DAY, time: "08:00", holdId: `h_${id}`, ...over });

test("capacity: a hold is refused when the slot is already full", () => {
  const full = [other("bk_a", "c2"), other("bk_b", "c3")]; // 08:00 holds 2
  const r = settleOwned(
    snap([client()], full),
    snap([client({ ledger: [hold({ id: "tx_hold_1" })] })], [booking({ slotId: S8, date: SLOT_DAY, time: "08:00" })]),
    owners,
    "client",
    RULE,
    NOW,
  );
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
  assert.equal(one(r).sessionsLeft, 4);
  assert.equal(r.bookings.filter((b) => b.slotId === S8).length, 2);
});

test("capacity: occupancy is shared across owners in one settlement", () => {
  const names = ["c1", "c2", "c3"];
  const clients = names.map((id) => client({ id, ledger: [hold({ id: `tx_${id}`, clientId: id, bookingId: `bk_${id}` })] }));
  const incoming = names.map((id) => booking({ id: `bk_${id}`, clientId: id, slotId: S8, date: SLOT_DAY, time: "08:00", holdId: `tx_${id}` }));
  const r = settleOwned(snap(names.map((id) => client({ id })), []), snap(clients, incoming), new Set(names), "client", RULE, NOW);
  assert.deepEqual(r.rejected, ["tx_c3"], "the third hold on a two-place slot is refused");
  assert.equal(r.bookings.length, 2);
});

test("capacity: a cancel earlier in the same ledger frees the place for a later hold", () => {
  const stored = booking({ id: "bk_old", slotId: S8, date: SLOT_DAY, time: "08:00", holdId: "tx_old" });
  const c2 = other("bk_c2", "c2");
  const c1 = client({ sessionsLeft: 4 });
  const cancelTxn = cancel("refund", stored, { id: "cancel:tx_old" });
  const newHold = hold({ id: "tx_new", bookingId: "bk_new" });
  const incoming = client({ ledger: [newHold, cancelTxn] }); // newest first
  const r = settleOwned(
    snap([c1], [stored, c2]),
    snap([incoming], [booking({ id: "bk_new", slotId: S8, date: SLOT_DAY, time: "08:00", holdId: "tx_new" })]),
    owners,
    "client",
    RULE,
    NOW,
  );
  assert.deepEqual(r.rejected, []);
  assert.equal(one(r).sessionsLeft, 4, "refund +1, hold -1");
  assert.ok(r.bookings.some((b) => b.id === "bk_new"));
});

test("closed slot: a hold is refused", () => {
  const r = settleOwned(
    { ...snap([client()]), closedSlotIds: ["2026-10-12_19:00"] },
    snap([client({ ledger: [hold()] })], [booking()]),
    owners,
    "client",
    RULE,
    NOW,
  );
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
  assert.equal(r.bookings.length, 0);
});

test("past slot: a hold is refused once the slot has started", () => {
  const r = settleOwned(
    snap([client()]),
    snap([client({ ledger: [hold()] })], [booking({ date: "2026-10-09", time: "19:00" })]),
    owners,
    "client",
    RULE,
    NOW,
  );
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
});

test("extra slot uses its own capacity, not the generated one", () => {
  const extraFull = {
    ...snap([client()], [other("bk_x", "c2", { slotId: "x1", time: "19:00" })]),
    extraSlots: [{ id: "x1", capacity: 1, date: "2026-10-12", time: "19:00" }],
  };
  const incoming = snap([client({ ledger: [hold({ bookingId: "bk_new" })] })], [booking({ id: "bk_new", slotId: "x1", time: "19:00", holdId: "tx_hold_1" })]);
  assert.deepEqual(settleOwned(extraFull, incoming, owners, "client", RULE, NOW).rejected, ["tx_hold_1"]);
  // Without the extra slot the id is not a real slot, so it is refused too.
  const noExtra = { ...extraFull, extraSlots: [] };
  assert.deepEqual(settleOwned(noExtra, incoming, owners, "client", RULE, NOW).rejected, ["tx_hold_1"]);
  // A generated 19:00 slot has three places, so the same single booking fits.
  const gen = booking({ id: "bk_new", slotId: "2026-10-12_19:00", time: "19:00", date: SLOT_DAY, holdId: "tx_hold_1" });
  const generated = snap([client({ ledger: [hold({ bookingId: "bk_new" })] })], [gen]);
  assert.deepEqual(settleOwned(snap([client()], [other("bk_x", "c2", { slotId: "2026-10-12_19:00", time: "19:00" })]), generated, owners, "client", RULE, NOW).rejected, []);
});

/* ---- a slot must be real; a move is checked like a hold ---- */

test("invented slot: a hold on a time the schedule does not generate is refused", () => {
  const fake = booking({ id: "bk_fake", slotId: "2026-10-12_12:00", time: "12:00", date: SLOT_DAY, holdId: "tx_hold_1" });
  const r = settleOwned(snap([client()]), snap([client({ ledger: [hold({ bookingId: "bk_fake" })] })], [fake]), owners, "client", RULE, NOW);
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
  assert.equal(r.bookings.length, 0);
});

test("invented slot: a slot id that does not match its date and time is refused", () => {
  const mismatch = booking({ id: "bk_mm", slotId: "2026-10-12_08:00", time: "19:00", date: SLOT_DAY, holdId: "tx_hold_1" });
  const r = settleOwned(snap([client()]), snap([client({ ledger: [hold({ bookingId: "bk_mm" })] })], [mismatch]), owners, "client", RULE, NOW);
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
});

test("Sunday has no generated slots: a hold there is refused", () => {
  const sun = "2026-10-11";
  const row = booking({ id: "bk_sun", slotId: `${sun}_19:00`, date: sun, time: "19:00", holdId: "tx_hold_1" });
  const r = settleOwned(snap([client()]), snap([client({ ledger: [hold({ bookingId: "bk_sun" })] })], [row]), owners, "client", RULE, NOW);
  assert.deepEqual(r.rejected, ["tx_hold_1"]);
});

test("move into a full slot is refused and the booking stays where it was", () => {
  const current = snap([client()], [booking(), other("bk_x1", "c2"), other("bk_x2", "c3")]);
  // S8 (08:00) has capacity 2 and is full with two other clients
  const moveIn = booking({ slotId: S8, date: SLOT_DAY, time: "08:00", holdId: "tx_hold_1" });
  const r = settleOwned(current, snap([client()], [moveIn]), owners, "client", RULE, NOW);
  const mine = r.bookings.find((b) => b.id === "bk_s1_c1");
  assert.equal(mine?.slotId, "2026-10-12_19:00");
  assert.equal(r.bookings.filter((b) => b.slotId === S8).length, 2);
});

test("move into a free slot succeeds and the old place is freed", () => {
  const current = snap([client()], [booking(), other("bk_x1", "c2")]);
  const moveIn = booking({ slotId: S8, date: SLOT_DAY, time: "08:00", holdId: "tx_hold_1" });
  const r = settleOwned(current, snap([client()], [moveIn]), owners, "client", RULE, NOW);
  const mine = r.bookings.find((b) => b.id === "bk_s1_c1");
  assert.equal(mine?.slotId, S8);
  assert.equal(mine?.time, "08:00");
});

test("move into a past slot is refused", () => {
  const past = booking({ slotId: "2026-10-10_09:00", date: "2026-10-10", time: "09:00", holdId: "tx_hold_1" });
  const r = settleOwned(snap([client()], [booking()]), snap([client()], [past]), owners, "client", RULE, NOW);
  assert.equal(r.bookings.find((b) => b.id === "bk_s1_c1")?.slotId, "2026-10-12_19:00");
});
