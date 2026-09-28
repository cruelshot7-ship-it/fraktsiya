import assert from "node:assert/strict";
import test from "node:test";
import { backupDay, backupFileName, DATABASE_ON_VOLUME, databaseLocation, shouldSendBackup } from "./studio-backup.ts";

test("database is not on a Railway volume", () => {
  assert.equal(DATABASE_ON_VOLUME, false);
  assert.equal(databaseLocation().volume, false);
  assert.equal(databaseLocation().engine, "postgres");
  assert.equal(databaseLocation().offsite, "telegram-file");
});

test("backup file goes out once per day", () => {
  assert.equal(shouldSendBackup(null, "2026-09-28"), true);
  assert.equal(shouldSendBackup("2026-09-27", "2026-09-28"), true);
  assert.equal(shouldSendBackup("2026-09-28", "2026-09-28"), false);
  assert.equal(backupFileName("2026-09-28"), "ruksha-db-2026-09-28.json");
});

test("backup day follows Minsk, not UTC midnight", () => {
  assert.equal(backupDay(new Date("2026-09-28T21:30:00.000Z")), "2026-09-29");
  assert.equal(backupDay(new Date("2026-09-28T20:30:00.000Z")), "2026-09-28");
});
