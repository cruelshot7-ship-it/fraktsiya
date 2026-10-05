from pathlib import Path
p = Path("src/components/app/client-slots.tsx")
t = p.read_text()
old = '''                  ) : left > 0 && !frozen ? (
                    {confirmId === slot.id ? ('''
new = '''                  ) : left > 0 && !frozen ? (
                    confirmId === slot.id ? ('''
if old not in t:
    if "left > 0 && !frozen ? (\n                    confirmId === slot.id" in t:
        print("already fixed")
        raise SystemExit(0)
    raise SystemExit("open missing")
t = t.replace(old, new, 1)
old_close = '''                        {(me.sessionsLeft ?? 0) <= 0 ? "Нет занятий" : "Записаться"}
                      </button>
                    )}
                  ) : left <= 0 && !waiting ? ('''
new_close = '''                        {(me.sessionsLeft ?? 0) <= 0 ? "Нет занятий" : "Записаться"}
                      </button>
                    )
                  ) : left <= 0 && !waiting ? ('''
if old_close not in t:
    raise SystemExit("close missing")
t = t.replace(old_close, new_close, 1)
p.write_text(t)
print("fixed")
