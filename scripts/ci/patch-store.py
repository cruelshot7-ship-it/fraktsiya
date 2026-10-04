from pathlib import Path
p = Path("src/lib/studio-store.ts")
t = p.read_text()
if "hasUnsyncedChanges" in t and "mergeClientCloudPayload" in t and "clientMerge" in t:
    print("store already patched")
    raise SystemExit(0)
old_imp = 'import { applyTelegramIdentity, scheduleCloudPush, syncFromCloud, telegramLocked } from "@/lib/studio-identity";'
new_imp = '''import { applyTelegramIdentity, flushCloudPush, hasUnsyncedChanges, scheduleCloudPush, syncFromCloud, telegramLocked } from "@/lib/studio-identity";
import { mergeBookingFlags, unionIds } from "@/lib/studio-merge";'''
if "hasUnsyncedChanges" not in t:
    if old_imp not in t:
        raise SystemExit("identity import missing")
    t = t.replace(old_imp, new_imp, 1)
helper = '''
/** Client cloud merge: local unsynced rows win; booking attendance flags OR-merge. */
function mergeClientCloudPayload(
  local: {
    food: FoodLog[];
    lifts: LiftLog[];
    workoutLogs: WorkoutLog[];
    dayChecks: DayCheck[];
    waitlist: WaitlistEntry[];
    checks: Record<string, string[]>;
    bookings: Booking[];
    dismissedSignalIds: string[];
  },
  payload: {
    food: FoodLog[];
    lifts: LiftLog[];
    workoutLogs: WorkoutLog[];
    dayChecks?: DayCheck[];
    waitlist: WaitlistEntry[];
    checks: Record<string, string[]>;
    bookings: Booking[];
    dismissedSignalIds: string[];
  },
) {
  const byLogId = <T extends { logId: string }>(server: T[], loc: T[]) => {
    const map = new Map(server.map((r) => [r.logId, r]));
    for (const r of loc) map.set(r.logId, r);
    return [...map.values()];
  };
  const byId = <T extends { id: string }>(server: T[], loc: T[]) => {
    const map = new Map(server.map((r) => [r.id, r]));
    for (const r of loc) map.set(r.id, r);
    return [...map.values()];
  };
  const checks: Record<string, string[]> = { ...(payload.checks ?? {}) };
  for (const [k, v] of Object.entries(local.checks ?? {})) {
    if (v?.length) checks[k] = v;
  }
  const bookingMap = new Map((payload.bookings ?? []).map((b) => [b.id, b]));
  for (const b of local.bookings) {
    const prev = bookingMap.get(b.id);
    bookingMap.set(b.id, prev ? mergeBookingFlags(b, prev) : b);
  }
  return {
    food: byLogId(payload.food ?? [], local.food ?? []),
    lifts: byId(payload.lifts ?? [], local.lifts ?? []),
    workoutLogs: byId(payload.workoutLogs ?? [], local.workoutLogs ?? []),
    dayChecks: byId(payload.dayChecks ?? [], local.dayChecks ?? []),
    waitlist: byId(payload.waitlist ?? [], local.waitlist ?? []),
    checks,
    bookings: [...bookingMap.values()],
    dismissedSignalIds: unionIds(local.dismissedSignalIds, payload.dismissedSignalIds ?? []),
  };
}

'''
if "function mergeClientCloudPayload" not in t:
    if "export const useStudio" not in t:
        raise SystemExit("no useStudio")
    t = t.replace("export const useStudio", helper + "export const useStudio", 1)
old_hydrate_set = """        notices: payload.notices,
        dismissedSignalIds: payload.dismissedSignalIds,
        notifyPrefs: payload.notifyPrefs,
        waitlist: payload.waitlist,
        workoutLogs: payload.workoutLogs,
        checks: payload.checks,
        visits: payload.visits ?? [],
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra, slotViewer(next.clients, cloud.role)),
        tab: cloud.role === "trainer" ? "clients" : get().tab === "clients" || get().tab === "signals" ? "slots" : get().tab,
      });
      persist(snap(get()), false);
      if (cloud.created) get().showToast("Вас приняли в зал.");
"""
new_hydrate_set = """        notices: payload.notices,
        dismissedSignalIds:
          cloud.role === "client"
            ? unionIds(get().dismissedSignalIds, payload.dismissedSignalIds ?? [])
            : payload.dismissedSignalIds,
        notifyPrefs: payload.notifyPrefs,
        waitlist: payload.waitlist,
        workoutLogs: payload.workoutLogs,
        checks: payload.checks,
        visits: payload.visits ?? [],
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra, slotViewer(next.clients, cloud.role)),
        tab: cloud.role === "trainer" ? "clients" : get().tab === "clients" || get().tab === "signals" ? "slots" : get().tab,
        ...(cloud.role === "client" && hasUnsyncedChanges()
          ? (() => {
              flushCloudPush();
              const m = mergeClientCloudPayload(get(), payload);
              return {
                food: m.food,
                lifts: m.lifts,
                workoutLogs: m.workoutLogs,
                dayChecks: m.dayChecks,
                waitlist: m.waitlist,
                checks: m.checks,
                bookings: m.bookings,
                dismissedSignalIds: m.dismissedSignalIds,
              };
            })()
          : {}),
      });
      persist(snap(get()), false);
      if (cloud.created) get().showToast("Вас приняли в зал.");
"""
if "mergeClientCloudPayload(get()" not in t:
    if old_hydrate_set not in t:
        raise SystemExit("hydrate missing")
    t = t.replace(old_hydrate_set, new_hydrate_set, 1)
old_refresh = """      set({
        role: cloud.role,
        inviteBlocked: Boolean(cloud.blocked) && !next.clients.length,
        removedClientIds: next.removedClientIds,
        clients: next.clients,
        coaches: payload.coaches ?? get().coaches,
        food: cloud.role === "trainer" ? payload.food : payload.food.length ? payload.food : get().food,
        dayChecks: cloud.role === "trainer" ? payload.dayChecks ?? [] : (payload.dayChecks ?? []).length ? payload.dayChecks ?? [] : get().dayChecks,
        lifts: cloud.role === "trainer" ? payload.lifts : payload.lifts.length ? payload.lifts : get().lifts,
        extraSlots: extra,
        closedSlotIds: payload.closedSlotIds.length ? [...new Set([...get().closedSlotIds, ...payload.closedSlotIds])] : get().closedSlotIds,
        notices: cloud.role === "trainer" ? payload.notices : payload.notices.length ? payload.notices : get().notices,
        workoutLogs: cloud.role === "trainer" ? payload.workoutLogs : payload.workoutLogs.length ? payload.workoutLogs : get().workoutLogs,
        visits: cloud.role === "trainer" ? payload.visits ?? [] : (payload.visits ?? []).length ? payload.visits ?? [] : get().visits,
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra, slotViewer(next.clients, cloud.role)),
        bookings: cloud.role === "trainer" ? payload.bookings ?? [] : ownBookings(get().bookings, payload.bookings ?? [], next.clients.map((client) => client.id)),
      });
      persist(snap(get()), false);
    });
  },
"""
new_refresh = """      const baseDismissed =
        cloud.role === "client"
          ? unionIds(get().dismissedSignalIds, payload.dismissedSignalIds ?? [])
          : payload.dismissedSignalIds ?? get().dismissedSignalIds;
      let clientMerge: ReturnType<typeof mergeClientCloudPayload> | null = null;
      if (cloud.role === "client" && hasUnsyncedChanges()) {
        flushCloudPush();
        clientMerge = mergeClientCloudPayload(get(), payload);
      }
      set({
        role: cloud.role,
        inviteBlocked: Boolean(cloud.blocked) && !next.clients.length,
        removedClientIds: next.removedClientIds,
        clients: next.clients,
        coaches: payload.coaches ?? get().coaches,
        food: clientMerge
          ? clientMerge.food
          : cloud.role === "trainer"
            ? payload.food
            : payload.food.length
              ? payload.food
              : get().food,
        dayChecks: clientMerge
          ? clientMerge.dayChecks
          : cloud.role === "trainer"
            ? payload.dayChecks ?? []
            : (payload.dayChecks ?? []).length
              ? payload.dayChecks ?? []
              : get().dayChecks,
        lifts: clientMerge
          ? clientMerge.lifts
          : cloud.role === "trainer"
            ? payload.lifts
            : payload.lifts.length
              ? payload.lifts
              : get().lifts,
        extraSlots: extra,
        closedSlotIds: payload.closedSlotIds.length ? [...new Set([...get().closedSlotIds, ...payload.closedSlotIds])] : get().closedSlotIds,
        notices: cloud.role === "trainer" ? payload.notices : payload.notices.length ? payload.notices : get().notices,
        dismissedSignalIds: clientMerge ? clientMerge.dismissedSignalIds : baseDismissed,
        workoutLogs: clientMerge
          ? clientMerge.workoutLogs
          : cloud.role === "trainer"
            ? payload.workoutLogs
            : payload.workoutLogs.length
              ? payload.workoutLogs
              : get().workoutLogs,
        checks: clientMerge ? clientMerge.checks : cloud.role === "client" ? payload.checks ?? get().checks : get().checks,
        waitlist: clientMerge
          ? clientMerge.waitlist
          : cloud.role === "trainer"
            ? payload.waitlist
            : payload.waitlist?.length
              ? payload.waitlist
              : get().waitlist,
        visits: cloud.role === "trainer" ? payload.visits ?? [] : (payload.visits ?? []).length ? payload.visits ?? [] : get().visits,
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra, slotViewer(next.clients, cloud.role)),
        bookings: clientMerge
          ? clientMerge.bookings
          : cloud.role === "trainer"
            ? payload.bookings ?? []
            : ownBookings(get().bookings, payload.bookings ?? [], next.clients.map((client) => client.id)),
      });
      persist(snap(get()), false);
    });
  },
"""
if "clientMerge" not in t:
    if old_refresh not in t:
        raise SystemExit("refresh missing")
    t = t.replace(old_refresh, new_refresh, 1)
p.write_text(t)
print("store patched", len(t))
