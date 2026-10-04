from pathlib import Path

# progression: drop dead admin role check
p = Path("src/lib/progression/server.ts")
t = p.read_text()
old = '    const isAdmin = session.role === "admin";\n    if (!isOwner && !isAdmin) {'
new = '    // Platform admin role not in TelegramSession yet — owner only.\n    if (!isOwner) {'
if old in t:
    t = t.replace(old, new, 1)
    p.write_text(t)
    print("progression patched")
elif "if (!isOwner)" in t and "isAdmin" not in t:
    print("progression already")
else:
    print("progression skip")

# MARIA_SESSIONS export
p = Path("src/data/studio.ts")
t = p.read_text()
if "export const MARIA_SESSIONS" in t:
    print("MARIA already exported")
elif "const MARIA_SESSIONS" in t:
    p.write_text(t.replace("const MARIA_SESSIONS", "export const MARIA_SESSIONS", 1))
    print("MARIA exported")
else:
    print("MARIA not found")

# db assert
p = Path("src/lib/db.ts")
t = p.read_text()
if "assertDatabaseConfigured" in t:
    print("db assert already")
else:
    marker = "export function getDbSource(): DbSource {"
    guard = '''
/** In production, refuse silent PGLite unless ALLOW_PGLITE=1. */
export function assertDatabaseConfigured() {
  if (typeof process === "undefined") return;
  if (process.env.ALLOW_PGLITE === "1" || process.env.ALLOW_PGLITE === "true") return;
  const isProd = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  if (isProd && !databaseUrlNow()) {
    throw new Error(
      "[db] DATABASE_URL is required in production. Set Neon DATABASE_URL (or ALLOW_PGLITE=1 for emergency only).",
    );
  }
}

'''
    t = t.replace(marker, guard + marker, 1)
    for sig in ["export async function getSql", "export function getSql"]:
        if sig in t:
            idx = t.find(sig)
            brace = t.find("{", idx)
            t = t[: brace + 1] + "\n  assertDatabaseConfigured();" + t[brace + 1 :]
            break
    p.write_text(t)
    print("db assert added")

# re-export Booking from studio-sync
p = Path("src/lib/studio-sync.ts")
t = p.read_text()
if "export type { Booking" in t:
    print("Booking export already")
else:
    needle = '  type Visit,\n} from "@/data/studio";'
    if needle in t:
        t = t.replace(needle, needle + '\n\nexport type { Booking, Client, Notice, Slot, WaitlistEntry } from "@/data/studio";', 1)
        p.write_text(t)
        print("Booking re-export added")
    else:
        print("Booking needle missing")
