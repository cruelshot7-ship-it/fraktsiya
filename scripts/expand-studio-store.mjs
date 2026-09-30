import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(root, "scripts");
const outPath = path.join(root, "src/lib/studio-store.ts");

const parts = [];
for (let i = 0; i < 20; i++) {
  const p = path.join(scripts, `studio-store.b64.${i}`);
  if (!fs.existsSync(p)) break;
  parts.push(fs.readFileSync(p, "utf8").trim());
}
let b64 = parts.join("");
if (!b64) {
  const single = path.join(scripts, "studio-store.b64");
  if (fs.existsSync(single)) b64 = fs.readFileSync(single, "utf8").trim();
}
if (!b64) {
  console.log("[expand-store] no b64, skip");
  process.exit(0);
}
const text = zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
if (!text.includes("export const useStudio")) {
  console.error("[expand-store] invalid payload");
  process.exit(1);
}
fs.writeFileSync(outPath, text);
console.log("[expand-store] wrote", outPath, text.length);
