import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scripts = path.join(root, "scripts");
const outPath = path.join(root, "src/lib/studio-store.ts");

function tryB64(b64, label) {
  if (!b64 || b64.length < 100) return null;
  try {
    const text = zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
    if (!text.includes("export const useStudio")) {
      console.error(`[expand-store] ${label}: invalid payload (no useStudio)`);
      return null;
    }
    return text;
  } catch (e) {
    console.error(`[expand-store] ${label}: gunzip failed`, e.message);
    return null;
  }
}

// Prefer single complete file first (avoids broken partial parts)
let text = null;
const single = path.join(scripts, "studio-store.b64");
if (fs.existsSync(single)) {
  const b64 = fs.readFileSync(single, "utf8").trim();
  text = tryB64(b64, "studio-store.b64");
}

if (!text) {
  const parts = [];
  for (let i = 0; i < 20; i++) {
    const p = path.join(scripts, `studio-store.b64.${i}`);
    if (!fs.existsSync(p)) break;
    parts.push(fs.readFileSync(p, "utf8").trim());
  }
  if (parts.length) {
    text = tryB64(parts.join(""), `parts 0-${parts.length - 1}`);
  }
}

if (!text) {
  console.log("[expand-store] no valid b64, skip");
  process.exit(0);
}

fs.writeFileSync(outPath, text);
console.log("[expand-store] wrote", outPath, text.length);
