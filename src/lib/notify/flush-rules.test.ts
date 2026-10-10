import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prepareEvent, type Session } from "./flush-rules.ts";

const trainer: Session = { role: "trainer", user: { id: "1" } };
const client: Session = { role: "client", user: { id: "42" } };

const confirmed = (over: Record<string, unknown> = {}) => ({
  id: "out_1",
  kind: "booking_confirmed",
  telegramId: "42",
  payload: { bookingId: "bk_1", clientId: "tg_42", date: "2026-10-12", time: "18:00", ...over },
});

describe("уведомления: кому и что можно отправить", () => {
  it("тренер пишет любому клиенту", () => {
    const r = prepareEvent(trainer, confirmed({}));
    assert.equal(r.ok, true);
  });

  it("клиент пишет только себе", () => {
    assert.equal(prepareEvent(client, confirmed()).ok, true);
    assert.deepEqual(prepareEvent(client, { ...confirmed(), telegramId: "999" }), { ok: false, error: "forbidden" });
  });

  it("неразрешённый вид уведомления отклоняется", () => {
    assert.deepEqual(prepareEvent(trainer, { ...confirmed(), kind: "generic" }), { ok: false, error: "kind_not_allowed" });
  });

  it("свободный текст в дате и времени не попадает в сообщение", () => {
    const r = prepareEvent(trainer, confirmed({ date: "<a href=x>срочно</a>", time: "перейдите по ссылке" }));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.text, "Запись подтверждена.");
  });

  it("текст собирается из шаблона при корректных дате и времени", () => {
    const r = prepareEvent(trainer, confirmed({}));
    assert.equal(r.ok && r.text, "Запись подтверждена: 2026-10-12 · 18:00");
  });

  it("отмена — фиксированный текст", () => {
    const r = prepareEvent(trainer, { id: "out_2", kind: "booking_cancelled", telegramId: "42", payload: { bookingId: "bk_1", clientId: "tg_42" } });
    assert.equal(r.ok && r.text, "Запись отменена.");
  });

  it("лишние поля payload отбрасываются", () => {
    const r = prepareEvent(trainer, confirmed({ secret: "x", note: "y" }));
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(Object.keys(r.payload).sort(), ["bookingId", "clientId", "date", "time"]);
  });

  it("ID с пробелами и спецсимволами отклоняются", () => {
    assert.deepEqual(prepareEvent(trainer, confirmed({ bookingId: "bk 1; drop" })), { ok: false, error: "bad_payload" });
  });
});
