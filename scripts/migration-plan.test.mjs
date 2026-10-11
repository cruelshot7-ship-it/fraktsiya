import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pendingMigrations, requiresApproval } from "./migration-plan.mjs";

const migrations = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

test("0005 notify outbox is marked as needing explicit approval", async () => {
  const text = await readFile(join(migrations, "0005_notify_outbox.sql"), "utf8");
  assert.equal(requiresApproval(text), true);
});

test("ordinary migrations do not need approval", async () => {
  for (const name of ["0004_core_booking.sql", "0006_slot_capacity_guard.sql", "0007_food_catalog.sql"]) {
    const text = await readFile(join(migrations, name), "utf8");
    assert.equal(requiresApproval(text), false, name);
  }
});

test("pending migrations skip applied ones, keep order and ignore subdirectories", () => {
  const pending = pendingMigrations(
    ["0006_b.sql", "auth", "0002_a.sql", "0007_c.sql"],
    ["0002_a.sql"],
  ).map((m) => m.name);
  assert.deepEqual(pending, ["0006_b.sql", "0007_c.sql"]);
});
