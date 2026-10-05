from pathlib import Path

p = Path("src/components/app/signals-view.tsx")
t = p.read_text()
if "К расписанию" in t:
    print("already")
    raise SystemExit(0)

old = '''          {items.map((item) => (
            <SignalCard
              key={item.id}
              item={item}
              onOpen={() => openClientSheet(item.clientId)}
              onDismiss={() => dismissSignal(item.id)}
              onOffer={
                item.kind === "cancel"
                  ? () => {
                      const next = bookings.find((b) => b.clientId === item.clientId);
                      if (next) selectDay(next.date);
                      setTab("slots");
                    }
                  : undefined
              }
            />
          ))}'''
new = '''          {items.map((item) => (
            <SignalCard
              key={item.id}
              item={item}
              onOpen={() => {
                if (item.clientId) openClientSheet(item.clientId);
                if (item.kind === "book" || item.kind === "cancel" || item.kind === "checkin") {
                  const row = bookings.find((b) => b.clientId === item.clientId && !b.noShow);
                  if (row) selectDay(row.date);
                }
              }}
              onDismiss={() => dismissSignal(item.id)}
              onOffer={
                item.kind === "cancel" || item.kind === "book"
                  ? () => {
                      const next = bookings.find((b) => b.clientId === item.clientId);
                      if (next) selectDay(next.date);
                      setTab("slots");
                    }
                  : undefined
              }
            />
          ))}'''
if old not in t:
    raise SystemExit("signals block missing")
t = t.replace(old, new, 1)
t = t.replace(
    '''        <button type="button" onClick={onOffer} className="pressable mt-3 h-10 w-full rounded-lg bg-secondary text-xs">
          Предложить другой слот
        </button>''',
    '''        <button type="button" onClick={onOffer} className="pressable mt-3 h-10 w-full rounded-lg bg-secondary text-xs">
          {item.kind === "book" ? "К расписанию" : "Предложить другой слот"}
        </button>''',
    1,
)
p.write_text(t)
print("E ok")
