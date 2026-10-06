from pathlib import Path
p = Path("src/lib/studio-identity.ts")
t = p.read_text()
if "lastCloudSyncAt" in t:
    print("already")
    raise SystemExit(0)

if 'const DIRTY_KEY = "ruksha:dirty";' not in t:
    raise SystemExit("DIRTY_KEY missing")
t = t.replace(
    'const DIRTY_KEY = "ruksha:dirty";',
    'const DIRTY_KEY = "ruksha:dirty";\nconst LAST_SYNC_KEY = "ruksha:lastSyncAt";',
    1,
)

old = """function setDirty(on: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    if (on) localStorage.setItem(DIRTY_KEY, "1");
    else localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* private mode */
  }
}"""
new = """function setDirty(on: boolean) {
  try {
    if (typeof localStorage === "undefined") return;
    if (on) localStorage.setItem(DIRTY_KEY, "1");
    else {
      localStorage.removeItem(DIRTY_KEY);
      localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("ruksha-sync"));
    }
  } catch {
    /* private mode */
  }
}

export function lastCloudSyncAt(): number | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LAST_SYNC_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}"""
if old not in t:
    raise SystemExit("setDirty missing")
t = t.replace(old, new, 1)
p.write_text(t)
print("ok")
