from pathlib import Path
p = Path("src/lib/studio-sync.ts")
t = p.read_text()
old = """      if (!current.clients.some((c) => c.telegramId === session.user.id) && uname) {
                const byName = current.clients.find(
                                           (c) => !c.telegramId && (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname,
        if (byName) {
          bound = {
            ...current,
            clients: current.clients.map((c) =>
              c.id === byName.id ? { ...c, telegramId: session.user.id, telegramUsername: session.user.username } : c,
            ),
          };
        }
      }"""
new = """      if (!current.clients.some((c) => c.telegramId === session.user.id) && uname) {
        const byName = current.clients.find(
          (c) => !c.telegramId && (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname,
        );
        if (byName) {
          bound = {
            ...current,
            clients: current.clients.map((c) =>
              c.id === byName.id ? { ...c, telegramId: session.user.id, telegramUsername: session.user.username } : c,
            ),
          };
        }
      }"""
if old in t:
    p.write_text(t.replace(old, new, 1))
    print("fixed")
elif "const byName = current.clients.find" in t and ");\n        if (byName)" in t:
    print("already fixed")
else:
    raise SystemExit("pattern missing")
