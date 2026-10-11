#!/usr/bin/env node
// Падает, если в скрипте `test` (package.json) указан файл, которого нет.
// Раньше отсутствующие файлы молча попадали в список и тесты «проходили» без них.
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const script = pkg.scripts?.test ?? "";

const listed = [...script.matchAll(/['"]?([\w./-]+\.test\.(?:ts|mjs))['"]?/g)]
  .map((m) => m[1])
  .filter((p) => !p.includes("*"));

const missing = [];
for (const rel of new Set(listed)) {
  try {
    await access(join(root, rel));
  } catch {
    missing.push(rel);
  }
}

if (missing.length) {
  console.error(`[check-test-list] missing test files listed in package.json:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
console.log(`[check-test-list] ok — ${new Set(listed).size} listed test files exist.`);

