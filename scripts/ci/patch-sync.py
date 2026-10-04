from pathlib import Path

p = Path("src/lib/studio-sync.ts")
t = p.read_text()
if "studio-merge" not in t:
    needle = 'import { z } from "zod";\n'
    t = t.replace(needle, needle + 'import { mergeBookingFlags, ownDismissed, unionIds } from "@/lib/studio-merge";\n', 1)

old_coach = """    trainerUsername: mine === String(TRAINER_TG_ID) ? incoming.trainerUsername || current.trainerUsername : current.trainerUsername,
  });
}"""
new_coach = """    trainerUsername: mine === String(TRAINER_TG_ID) ? incoming.trainerUsername || current.trainerUsername : current.trainerUsername,
    dismissedSignalIds: unionIds(current.dismissedSignalIds, incoming.dismissedSignalIds),
  });
}"""
if "dismissedSignalIds: unionIds(current.dismissedSignalIds" not in t:
    if old_coach not in t:
        raise SystemExit("coach pattern missing")
    t = t.replace(old_coach, new_coach, 1)

old_book = """      ...incoming.bookings.filter((b) => b.clientId === id).map((row) => {
        const prev = current.bookings.find((item) => item.id === row.id);
        return {
          ...row,
          reminded24: row.reminded24 || prev?.reminded24,
          reminded2: row.reminded2 || prev?.reminded2,
          confirmed: row.confirmed || prev?.confirmed,
        };
      }),"""
new_book = """      ...incoming.bookings.filter((b) => b.clientId === id).map((row) => {
        const prev = current.bookings.find((item) => item.id === row.id);
        return mergeBookingFlags(
          {
            ...row,
            reminded24: row.reminded24 || prev?.reminded24,
            reminded2: row.reminded2 || prev?.reminded2,
          },
          prev,
        );
      }),"""
if old_book in t:
    t = t.replace(old_book, new_book, 1)

old_ret = """    visits: mergeVisits(current.visits ?? [], incoming.visits ?? [], new Set([id])),
  };
}"""
new_ret = """    visits: mergeVisits(current.visits ?? [], incoming.visits ?? [], new Set([id])),
    dismissedSignalIds: ownDismissed(
      current.dismissedSignalIds ?? [],
      incoming.dismissedSignalIds ?? [],
      current.notices,
      id,
    ),
  };
}"""
if "ownDismissed(" not in t:
    if old_ret not in t:
        raise SystemExit("mergeClientWrite return missing")
    t = t.replace(old_ret, new_ret, 1)

if 'console.error("[studio-save]"' not in t:
    t = t.replace(
"""  } catch {
    /* ignore */
  }
  try {
    await maybeDailyBackup(next);
  } catch {
    /* the copy must not block a save */
  }
}""",
"""  } catch (err) {
    console.error("[studio-save]", err);
  }
  try {
    await maybeDailyBackup(next);
  } catch (err) {
    console.error("[studio-save]", err);
  }
}""",
    1,
)

if 'reason: "save-failed"' not in t:
    old_push = """    await saveStudioState(next);
    return { ok: true };
  });

export const addCoachFn"""
    new_push = """    try {
      await saveStudioState(next);
    } catch (err) {
      console.error("[studio-save]", err);
      return { ok: false, reason: "save-failed" };
    }
    return { ok: true };
  });

export const addCoachFn"""
    if old_push not in t:
        raise SystemExit("pushStudio save pattern missing")
    t = t.replace(old_push, new_push, 1)

p.write_text(t)
print("studio-sync ok")

pj = Path("package.json")
pt = pj.read_text()
if "studio-merge.test.ts" not in pt:
    pt = pt.replace("src/lib/studio-scope.test.ts", "src/lib/studio-merge.test.ts src/lib/studio-scope.test.ts", 1)
    pj.write_text(pt)
    print("package.json ok")
