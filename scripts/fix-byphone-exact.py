from pathlib import Path
p = Path("src/lib/studio-sync.ts")
t = p.read_text()
old = """      const byPhone =
        wantPhone.length >= 10
                                ? payload.clients.find((c) => !c.telegramId && digitsPhone(c.phone).endsWith(wantPhone.slice(-10)))
      const match = byName ?? byPhone;"""
new = """      const byPhone =
        wantPhone.length >= 10
          ? payload.clients.find((c) => !c.telegramId && digitsPhone(c.phone).endsWith(wantPhone.slice(-10)))
          : undefined;
      const match = byName ?? byPhone;"""
if old in t:
    p.write_text(t.replace(old, new, 1))
    print("fixed")
elif ": undefined;" in t and "const byPhone" in t:
    print("already fixed")
else:
    raise SystemExit("pattern missing")
