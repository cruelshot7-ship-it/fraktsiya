#!/usr/bin/env node
/**
 * Restores src/lib/studio-sync.ts from embedded base64 parts.
 * Temporary until full file is committed directly.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const embedDir = join(root, "scripts", "studio-sync-embed");
const parts = readdirSync(embedDir)
  .filter((f) => f.endsWith(".b64"))
  .sort();
const b64 = parts.map((f) => readFileSync(join(embedDir, f), "utf8").trim()).join("");
const text = Buffer.from(b64, "base64").toString("utf8");
if (!text.includes("export type StudioPayload")) {
  console.error("[restore-studio-sync] decoded content looks invalid");
  process.exit(1);
}
if (text.includes("PLACEHOLDER")) {
  console.error("[restore-studio-sync] refusing to write PLACEHOLDER");
  process.exit(1);
}
const out = join(root, "src", "lib", "studio-sync.ts");
writeFileSync(out, text);
console.log("[restore-studio-sync] wrote", out, text.length, "chars from", parts.length, "parts");
