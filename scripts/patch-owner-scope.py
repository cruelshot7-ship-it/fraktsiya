from pathlib import Path

p = Path("src/components/app/clients-view.tsx")
t = p.read_text()

# Already fixed?
if t.find("{owner ?") < t.find("function ClientSheetBody") and "const owner =" in t:
    # Check owner not in sheet body
    sheet = t[t.find("function ClientSheetBody"):]
    if "{owner ?" not in sheet and "teamOpen" not in sheet:
        print("already fixed")
        raise SystemExit(0)

start_marker = '      {owner ? (\n        <div className="mt-2 space-y-2 border-t border-hairline/40 pt-3">'
idx = t.find(start_marker)
if idx < 0:
    raise SystemExit("owner block start not found")

tail = "        </div>\n      ) : null}\n"
end_idx = t.find(tail, idx)
if end_idx < 0:
    raise SystemExit("owner block end not found")
end_idx = end_idx + len(tail)

owner_block = t[idx:end_idx]
t2 = t[:idx] + t[end_idx:]

insert_anchor = (
    '      <details className="rounded-xl bg-card px-4 py-3 shadow-border">\n'
    '        <summary className="cursor-pointer text-sm text-muted-foreground">Разработка</summary>'
)
if insert_anchor not in t2:
    raise SystemExit("insert anchor not found")

t3 = t2.replace(insert_anchor, owner_block + "\n" + insert_anchor, 1)

if t3.count("{owner ?") != 1:
    raise SystemExit("owner count wrong")
if t3.find("{owner ?") > t3.find("function ClientSheetBody"):
    raise SystemExit("owner still after ClientSheetBody")

p.write_text(t3)
print("ok")
