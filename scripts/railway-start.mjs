#!/usr/bin/env node
/**
 * Railway entry: serve the production build on 0.0.0.0:$PORT.
 * Vite's config pins local QA preview to 127.0.0.1:8081 — CLI flags here override that.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const port = String(process.env.PORT || "8080");
const host = process.env.HOST || "0.0.0.0";
const vite = join(root, "node_modules", ".bin", "vite");
const wrapper = join(root, "scripts", "with-app-env.mjs");

if (!existsSync(vite)) {
  console.error("[railway] vite binary missing — npm ci did not install devDependencies");
  process.exit(1);
}

console.log(`[railway] preview ${host}:${port}`);

const child = spawn(process.execPath, [wrapper, vite, "preview", "--host", host, "--port", port, "--strictPort"], {
  cwd: root,
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    try {
      child.kill(signal);
    } catch {
      /* already gone */
    }
  });
}

child.on("error", (err) => {
  console.error("[railway] start failed:", err?.message || err);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
