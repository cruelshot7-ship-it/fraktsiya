import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const b64Path = path.join(root, "scripts/studio-store.b64");
const outPath = path.join(root, "src/lib/studio-store.ts");
if (!fs.existsSync(b64Path)) {
  console.log("[expand-store] no b64, skip");
  process.exit(0);
}
const b64 = fs.readFileSync(b64Path, "utf8").trim();
const text = zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
if (!text.includes("export const useStudio")) {
  console.error("[expand-store] invalid payload");
  process.exit(1);
}
fs.writeFileSync(outPath, text);
console.log("[expand-store] wrote", outPath, text.length);
