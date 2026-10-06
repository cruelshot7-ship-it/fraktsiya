from pathlib import Path

p = Path("src/components/app/program-view.tsx")
t = p.read_text()
if "localStorage.setItem(startKey" in t and "sessionStorage" not in t:
    print("already")
    raise SystemExit(0)

t = t.replace("sessionStorage", "localStorage")

old = '''                onClick={() => {
                  if (!startedAt) {
                    showToast("Сначала нажмите «Начать».");
                    return;
                  }
                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume);
                }}'''
new = '''                onClick={() => {
                  if (!startedAt) {
                    showToast("Сначала нажмите «Начать».");
                    return;
                  }
                  completeWorkout(itemCount || checked.length, withRest, new Date(startedAt).toISOString(), totals.volume);
                  try {
                    if (startKey) localStorage.removeItem(startKey);
                    if (factKey) localStorage.removeItem(factKey);
                  } catch {
                    /* ignore */
                  }
                  setStartedAt(null);
                  setFacts({});
                }}'''
if old not in t:
    if "localStorage.removeItem(startKey)" in t:
        print("complete already")
    else:
        raise SystemExit("complete handler missing")
else:
    t = t.replace(old, new, 1)

p.write_text(t)
print("ok", t.count("sessionStorage"), t.count("localStorage"))
