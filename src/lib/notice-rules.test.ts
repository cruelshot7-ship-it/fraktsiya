import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTICE_TTL_MS, noticeExpiry, noticeStartParam, openVerdict, parseNoticeParam, type NoticeRow } from "./notice-rules";

const now = new Date("2026-10-15T06:00:00.000Z");
const row = (over: Partial<NoticeRow> = {}): NoticeRow => ({
  id: 7,
  telegramId: "111",
  expiresAt: new Date(now.getTime() + 1000),
  openedAt: null,
  ...over,
});

test("неоткрытое уведомление своего клиента — можно показать один раз", () => {
  assert.equal(openVerdict(row(), "111", now), "open");
});

test("повторное открытие — opened, текст не показывается", () => {
  assert.equal(openVerdict(row({ openedAt: now }), "111", now), "opened");
});

test("срок вышел — expired; ровно в момент истечения тоже истёк", () => {
  assert.equal(openVerdict(row({ expiresAt: new Date(now.getTime() - 1) }), "111", now), "expired");
  assert.equal(openVerdict(row({ expiresAt: now }), "111", now), "expired");
});

test("чужой пользователь или нет записи — missing, без различия причин", () => {
  assert.equal(openVerdict(row(), "222", now), "missing");
  assert.equal(openVerdict(null, "111", now), "missing");
});

test("сравнение id пользователя как строки: число и строка совпадают", () => {
  assert.equal(openVerdict(row({ telegramId: "111" }), 111 as unknown as string, now), "open");
});

test("срок хранения — семь дней от момента создания", () => {
  assert.equal(noticeExpiry(now).getTime() - now.getTime(), NOTICE_TTL_MS);
  assert.equal(NOTICE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
});

test("параметр запуска: n_<id> туда и обратно; чужие параметры — null", () => {
  assert.equal(noticeStartParam(42), "n_42");
  assert.equal(parseNoticeParam("n_42"), 42);
  assert.equal(parseNoticeParam("N_42"), 42);
  assert.equal(parseNoticeParam("m_abc"), null);
  assert.equal(parseNoticeParam("ref_123"), null);
  assert.equal(parseNoticeParam("n_"), null);
  assert.equal(parseNoticeParam("n_0"), null);
  assert.equal(parseNoticeParam("n_42; drop table"), null);
  assert.equal(parseNoticeParam("n_9999999999999999999"), null);
});
