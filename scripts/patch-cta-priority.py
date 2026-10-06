from pathlib import Path
p = Path("src/lib/action-items.ts")
t = p.read_text()
old = '''  if (next) {
    items.push({
      id: `act_next_${next.id}`,
      kind: "next_session",
      title: `Ближайшая · ${next.time}`,
      body: `${next.date === today ? "Сегодня" : next.date} · ${next.duration} мин`,
      tab: "schedule",
      bookingId: next.id,
      clientId: client.id,
      priority: 10,
    });
    if (next.date === today) {
      items.push({
        id: `act_plan_${next.id}`,
        kind: "today_plan",
        title: "План на сегодня",
        body: "Откройте программу занятия",
        tab: "program",
        bookingId: next.id,
        clientId: client.id,
        priority: 20,
      });
    }
  } else {'''
new = '''  if (next) {
    if (next.date === today) {
      items.push({
        id: `act_plan_${next.id}`,
        kind: "today_plan",
        title: `Тренировка сегодня · ${next.time}`,
        body: "Откройте программу и отметьте подходы",
        tab: "program",
        bookingId: next.id,
        clientId: client.id,
        priority: 5,
      });
    } else {
      items.push({
        id: `act_next_${next.id}`,
        kind: "next_session",
        title: `Ближайшая · ${next.time}`,
        body: `${next.date} · ${next.duration} мин`,
        tab: "schedule",
        bookingId: next.id,
        clientId: client.id,
        priority: 10,
      });
    }
  } else {'''
if old not in t:
    # try schedule already applied tabs
    if "Тренировка сегодня" in t:
        print("already")
    else:
        raise SystemExit("block missing")
else:
    p.write_text(t.replace(old, new, 1))
    print("ok")
