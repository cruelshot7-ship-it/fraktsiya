
import { createServerFn } from "@tanstack/react-start";
import { bindCoachRule, canSendBotLinkRule, isCoachUserRule, visitsForClients } from "@/lib/access/binding-rules";
import { backupDay, shouldSendBackup } from "@/lib/studio-backup";
import { clientSlotView } from "@/lib/studio-scope";
import { z } from "zod";
import { mergeBookingFlags, ownDismissed, unionIds } from "@/lib/studio-merge";
import { keepClientOwned } from "@/lib/client-owned";
import { newReferralCode, referralCodeFromStart, referrerByCode } from "@/lib/referral";
import { applyCoachNotices, coachNoticeText, dueCoachNotices, type CoachNotice } from "@/lib/coach-notice";
import { withoutTrainerMoney } from "@/lib/payments";
import { programFor } from "@/lib/program-import";
import { mergeCoachTemplates, type ProgramTemplate } from "@/lib/templates/program-template";
import { mergeWeightHistory, weightNow } from "@/lib/weight-history";
import { mergeMeasures } from "@/lib/body-measures";
import { coachTierLine } from "@/lib/coach-tier";
import { retryUpdate, type RetryOutcome } from "@/lib/state-retry";
import { anonymizedIdentity, appendConsentLog, consentLogAfter, erasureNotice, PRIVACY_VERSION, stampConsent } from "@/lib/privacy";
import { guardBodyFields, guardRows, healthWriteAllowed } from "@/lib/health-write-gate";
import { isRevisioned, nextRevision, readRevision } from "@/lib/studio-revision";
import { settleOwned, type Balance } from "@/lib/balance";
import { applyClientChoices, checkMenus, menusForClient, mergeMenus, type MenuRecord } from "@/lib/menu-scope";
import { dropCheckIds, mergeChecks } from "@/lib/checks-merge";
import { coachTokenFromStart } from "@/lib/invite-start";
import {
  clientCoach,
  coachKey,
  coachPhase,
  COACH_PAID_DAYS,
  COACH_TRIAL_CAP,
  emptyClient,
  hoursAgoIso,
  TRAINER_TG_ID,
  type Booking,
  type Client,
  type Coach,
  type FoodLog,
  type DayCheck,
  type JoinRequest,
  type LiftLog,
  type Notice,
  type NotifyPrefs,
  type Slot,
  type WaitlistEntry,
  type WorkoutLog,
  type Visit,
} from "@/data/studio";

export type StudioPayload = {
  bookings: Booking[];
  food: FoodLog[];
  dayChecks: DayCheck[];
  lifts: LiftLog[];
  clients: Client[];
  extraSlots: Slot[];
  closedSlotIds: string[];
  dismissedSignalIds: string[];
  notices: Notice[];
  notifyPrefs: NotifyPrefs;
  waitlist: WaitlistEntry[];
  workoutLogs: WorkoutLog[];
  checks: Record<string, string[]>;
  trainerUsername: string | null;
  joinRequests: JoinRequest[];
  removedClientIds: string[];
  coaches: Coach[];
  foreignHolds?: Record<string, number>;
  visits?: Visit[];
  /** revision of the stored row (see studio-revision): a save is refused when the row has moved on */
  rev?: number;
  /** the trainer's program templates; clients never receive them (see scopePayload) */
  programTemplates?: ProgramTemplate[];
  /** дни питания: тренер пишет меню своих клиентов, клиент видит только подтверждённые и пишет только свой выбор */
  menus?: MenuRecord[];
};

// Re-export domain types so consumers (studio-scope, tests) can import from here
export type {
  Booking,
  Client,
  Coach,
  FoodLog,
  DayCheck,
  JoinRequest,
  LiftLog,
  Notice,
  NotifyPrefs,
  Slot,
  WaitlistEntry,
  WorkoutLog,
  Visit,
} from "@/data/studio";

const STUDIO_ID = "ruksha";

const PullInput = z.object({
  initData: z.string().optional(),
});

const PushInput = z.object({
  initData: z.string().optional(),
  payload: z.custom<StudioPayload>((val) => val != null && typeof val === "object"),
});

export function emptyPayload(): StudioPayload {
  return {
    bookings: [],
    food: [],
    dayChecks: [],
    lifts: [],
    clients: [],
    extraSlots: [],
    closedSlotIds: [],
    dismissedSignalIds: [],
    notices: [],
    notifyPrefs: {
      windowHours: 2,
      notifyClient: true,
      notifyTrainer: true,
      flagLate: true,
      absentDays: 10,
      address: "Гродно, Лидская 1",
    },
    waitlist: [],
    workoutLogs: [],
    checks: {},
    trainerUsername: null,
    joinRequests: [],
    removedClientIds: [],
    coaches: [],
    visits: [],
    menus: [],
  };
}

function normalizePayload(raw: Partial<StudioPayload> | null | undefined): StudioPayload {
  const empty = emptyPayload();
  if (!raw || typeof raw !== "object") return empty;
  const removed = raw.removedClientIds ?? [];
  return restoreInviteOwner(ensureApprovedClients({
    ...empty,
    ...raw,
    bookings: raw.bookings ?? [],
    food: raw.food ?? [],
    dayChecks: raw.dayChecks ?? [],
    programTemplates: raw.programTemplates ?? [],
    lifts: raw.lifts ?? [],
    extraSlots: raw.extraSlots ?? [],
    closedSlotIds: raw.closedSlotIds ?? [],
    dismissedSignalIds: raw.dismissedSignalIds ?? [],
    notices: raw.notices ?? [],
    notifyPrefs: {
      ...empty.notifyPrefs,
      ...raw.notifyPrefs,
      absentDays: raw.notifyPrefs?.absentDays || empty.notifyPrefs.absentDays,
      address: raw.notifyPrefs?.address || empty.notifyPrefs.address,
    },
    waitlist: raw.waitlist ?? [],
    workoutLogs: raw.workoutLogs ?? [],
    checks: raw.checks ?? {},
    trainerUsername: raw.trainerUsername ?? null,
    joinRequests: raw.joinRequests ?? [],
    removedClientIds: removed,
    coaches: (Array.isArray(raw.coaches) ? raw.coaches : []).map((coach) => ({
      ...coach,
      addedAt: coach.addedAt || new Date().toISOString(),
    })),
    foreignHolds: undefined,
    visits: raw.visits ?? [],
    menus: checkMenus(raw.menus),
    clients: (raw.clients ?? []).filter((c) => !isRemovedClient(c, removed)),
  }));
}

function pendingVisit(user: { id: string; firstName: string; lastName: string; username: string | null }, message?: string): JoinRequest {
  return {
    id: `jr_${user.id}`,
    telegramId: user.id,
    telegramUsername: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    message: (message ?? "Открыл приложение по ссылке").trim().slice(0, 500) || "Открыл приложение по ссылке",
    at: hoursAgoIso(0),
    status: "pending",
  };
}

function clientFromTelegram(user: {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
}): Client {
  const base = emptyClient();
  return {
    ...base,
    id: `tg_${user.id}`,
    firstName: user.firstName,
    lastName: user.lastName || "Telegram",
    telegramId: user.id,
    telegramUsername: user.username,
    sessionsLeft: 0,
    packExpiresAt: null,
    lastReportAt: null,
    streak: 0,
  };
}

function scopePayload(payload: StudioPayload, telegramId: string): StudioPayload {
  const mine = payload.clients.find((c) => c.telegramId === telegramId);
  const id = mine?.id ?? null;
  const slots = clientSlotView(payload.bookings, id);
  return {
    ...payload,
    clients: mine ? [withoutTrainerMoney(mine)] : [],
    bookings: slots.bookings,
    foreignHolds: slots.foreignHolds,
    food: id ? payload.food.filter((f) => f.clientId === id) : [],
    dayChecks: id ? (payload.dayChecks ?? []).filter((d) => d.clientId === id) : [],
    programTemplates: [],
    lifts: id ? payload.lifts.filter((l) => l.clientId === id) : [],
    workoutLogs: id ? payload.workoutLogs.filter((w) => w.clientId === id) : [],
    notices: id ? payload.notices.filter((n) => n.audience === "client" && n.clientId === id) : [],
    dismissedSignalIds: payload.dismissedSignalIds,
    waitlist: id ? payload.waitlist.filter((w) => w.clientId === id) : [],
    checks: id
      ? Object.fromEntries(Object.entries(payload.checks).filter(([k]) => k.startsWith(`${id}:`)))
      : {},
    extraSlots: slotsForCoach(payload.extraSlots, mine ? clientCoach(mine) : String(TRAINER_TG_ID)),
    visits: id ? (payload.visits ?? []).filter((row) => row.clientId === id) : [],
    menus: menusForClient(payload.menus ?? [], id),
    trainerUsername: payload.trainerUsername ?? null,
    joinRequests: (payload.joinRequests ?? []).filter((r) => r.telegramId === telegramId),
    coaches: [],
    removedClientIds: [],
  };
}

function sameHandle(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? "").replace(/^@/, "").trim().toLowerCase();
  const right = (b ?? "").replace(/^@/, "").trim().toLowerCase();
  return Boolean(left) && left === right;
}

/** Чужой telegramId строки тренера не перезаписывается; handle занимает только пустую строку (см. binding-rules). */
export function bindCoach(payload: StudioPayload, user: { id: string; username: string | null; firstName: string; lastName: string }) {
  return bindCoachRule(payload, user);
}

/** Доступ тренера — только по numeric Telegram id (правила в binding-rules). */
export function isCoachUser(payload: StudioPayload, user: { id: string; username: string | null }) {
  return isCoachUserRule(payload, user);
}

function coachRow(payload: StudioPayload, user: { id: string; username: string | null }) {
  return (payload.coaches ?? []).find((c) => c.telegramId === user.id);
}

export function coachFromStart(start: string, payload: StudioPayload) {
  const token = coachTokenFromStart(start);
  // No deep-link (opened Mini App / bot without c_CODE / coach_CODE) → main trainer (Ruksha).
  if (!token) return String(TRAINER_TG_ID);
  if (token === String(TRAINER_TG_ID)) return String(TRAINER_TG_ID);
  const coach = (payload.coaches ?? []).find((c) => c.code === token || c.telegramId === token);
  if (!coach?.telegramId) return String(TRAINER_TG_ID);
  const phase = coachPhase(coach);
  if (phase !== "trial" && phase !== "paid") return "";
  return coach.telegramId;
}

function restoreInviteOwner(payload: StudioPayload): StudioPayload {
  const clients = payload.clients.map((client) => {
    const req = (payload.joinRequests ?? []).find(
      (r) => r.telegramId === client.telegramId && r.coachId && r.coachId !== String(TRAINER_TG_ID),
    );
    if (!req?.coachId || clientCoach(client) !== String(TRAINER_TG_ID)) return client;
    return { ...client, coachId: req.coachId };
  });
  return { ...payload, clients };
}

export function scopeCoach(payload: StudioPayload, coachId: string): StudioPayload {
  const mine = coachKey(coachId);
  const clients = payload.clients.filter((c) => clientCoach(c) === mine);
  const ids = new Set(clients.map((c) => c.id));
  const holds: Record<string, number> = {};
  for (const booking of payload.bookings) {
    if (ids.has(booking.clientId)) continue;
    holds[booking.slotId] = (holds[booking.slotId] ?? 0) + 1;
  }
  return {
    ...payload,
    clients,
    bookings: payload.bookings.filter((b) => ids.has(b.clientId)),
    food: payload.food.filter((f) => ids.has(f.clientId)),
    dayChecks: (payload.dayChecks ?? []).filter((d) => ids.has(d.clientId)),
    menus: (payload.menus ?? []).filter((m) => ids.has(m.clientId)),
    lifts: payload.lifts.filter((l) => ids.has(l.clientId)),
    workoutLogs: payload.workoutLogs.filter((w) => ids.has(w.clientId)),
    // F-21: без этого строки визитов всех клиентов уходили бы тренеру через ...payload
    visits: visitsForClients(payload.visits, ids),
    waitlist: payload.waitlist.filter((w) => ids.has(w.clientId)),
    notices: payload.notices.filter((n) => n.clientId && ids.has(n.clientId)),
    checks: Object.fromEntries(Object.entries(payload.checks).filter(([k]) => [...ids].some((id) => k.startsWith(`${id}:`)))),
    joinRequests: (payload.joinRequests ?? []).filter((r) => coachKey(r.coachId) === mine),
    programTemplates: (payload.programTemplates ?? []).filter((t) => coachKey(t.coachId) === mine),
    removedClientIds: payload.removedClientIds ?? [],
    coaches:
      mine === String(TRAINER_TG_ID)
        ? payload.coaches ?? []
        : (payload.coaches ?? []).filter((c) => c.telegramId === mine),
    extraSlots: slotsForCoach(payload.extraSlots, mine),
    closedSlotIds: (payload.closedSlotIds ?? []).filter((id) => slotsForCoach(payload.extraSlots, mine).some((slot) => slot.id === id) || (mine === String(TRAINER_TG_ID) && /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(id))),
    foreignHolds: holds,
  };
}

function slotsForCoach(slots: Slot[] | undefined, coachId: string) {
  const mine = coachKey(coachId);
  return (slots ?? []).filter((slot) => coachKey(slot.ownerId) === mine);
}

function mergeClosedSlots(current: string[], incoming: string[], slots: Slot[], mine: string) {
  const owner = coachKey(mine);
  const own = new Set(slots.filter((slot) => coachKey(slot.ownerId) === owner).map((slot) => slot.id));
  const hall = (id: string) => owner === String(TRAINER_TG_ID) && /^\d{4}-\d{2}-\d{2}_\d{2}:\d{2}$/.test(id);
  const touch = (id: string) => own.has(id) || hall(id);
  return [...new Set([...current.filter((id) => !touch(id)), ...incoming.filter(touch)])];
}

function mergeOwnSlots(current: Slot[], incoming: Slot[], mine: string) {
  const owner = coachKey(mine);
  const foreign = current.filter((slot) => coachKey(slot.ownerId) !== owner);
  const map = new Map(foreign.map((slot) => [slot.id, slot]));
  for (const slot of incoming) {
    if (coachKey(slot.ownerId) !== owner) continue;
    map.set(slot.id, { ...slot, ownerId: owner === String(TRAINER_TG_ID) ? slot.ownerId || null : owner });
  }
  return [...map.values()];
}

function mergeVisits(current: Visit[], incoming: Visit[], ids: Set<string>) {
  const map = new Map(current.map((row) => [row.id, row]));
  for (const row of incoming) {
    if (!ids.has(row.clientId)) continue;
    const prev = map.get(row.id);
    map.set(row.id, prev ? { ...prev, ...row, waterMl: Math.max(prev.waterMl || 0, row.waterMl || 0) } : row);
  }
  return [...map.values()];
}

function mergeDayRows(current: DayCheck[], incoming: DayCheck[], replaceIds: Set<string>) {
  const kept = current.filter((row) => !replaceIds.has(row.clientId));
  const map = new Map(current.filter((row) => replaceIds.has(row.clientId)).map((row) => [row.id, row]));
  for (const row of incoming) {
    if (!replaceIds.has(row.clientId)) continue;
    const prev = map.get(row.id);
    if (!prev) {
      map.set(row.id, row);
      continue;
    }
    map.set(row.id, {
      ...prev,
      ...row,
      steps: Math.max(prev.steps || 0, row.steps || 0),
      sleepHours: Math.max(prev.sleepHours || 0, row.sleepHours || 0),
      waterMl: Math.max(prev.waterMl || 0, row.waterMl || 0),
      moveMin: Math.max(prev.moveMin || 0, row.moveMin || 0),
      moveKind: row.moveKind || prev.moveKind,
      source: prev.source === "apple" || row.source === "apple" ? "apple" : row.source || prev.source,
    });
  }
  return [...kept, ...map.values()];
}

export function mergeCoachPayload(current: StudioPayload, incoming: StudioPayload, coachId: string): StudioPayload {
  const mine = coachKey(coachId);
  const foreignIds = new Set(current.clients.filter((c) => clientCoach(c) !== mine).map((c) => c.id));
  const incomingMine = (incoming.clients ?? [])
    .filter((c) => !foreignIds.has(c.id))
    .filter((c) => !c.coachId || coachKey(c.coachId) === mine)
    .map((c) => ({ ...c, coachId: mine }));
  const myOld = current.clients.filter((c) => clientCoach(c) === mine);
  const removed = (incoming.removedClientIds ?? []).filter((id) => myOld.some((c) => isRemovedClient(c, [id])));
  const row = (current.coaches ?? []).find((c) => c.telegramId === mine);
  const phase = mine === String(TRAINER_TG_ID) ? "paid" : row ? coachPhase(row) : "expired";
  const allowedIncoming =
    phase === "paused" || phase === "expired" ? incomingMine.filter((c) => myOld.some((old) => old.id === c.id)) : incomingMine;
  let myClients = mergeClients(myOld, allowedIncoming).filter((c) => !isRemovedClient(c, removed));
  if (phase === "trial" && myClients.length > COACH_TRIAL_CAP) {
    const oldIds = new Set(myOld.map((c) => c.id));
    const kept = myClients.filter((c) => oldIds.has(c.id));
    const fresh = myClients.filter((c) => !oldIds.has(c.id));
    myClients = [...kept, ...fresh.slice(0, Math.max(0, COACH_TRIAL_CAP - kept.length))];
  }
  const oldIds = new Set(myOld.map((c) => c.id));
  const oldBookingIds = new Set(current.bookings.filter((b) => oldIds.has(b.clientId)).map((b) => b.id));
  const incomingBookings =
    phase === "paused" || phase === "expired"
      ? (incoming.bookings ?? []).filter((b) => oldBookingIds.has(b.id))
      : incoming.bookings ?? [];
  const myIds = new Set(myClients.map((c) => c.id));
  // Строки о здоровье (еда, дни, меню) своих клиентов без согласия не заменяются копией тренера,
  // даже если копия свежее: отозванное согласие не возвращает данные.
  const healthBlocked = new Set([...myIds].filter((id) => !healthWriteAllowed(myClients.find((c) => c.id === id)?.consent)));
  const healthRowIds = new Set([...oldIds, ...myIds].filter((id) => !healthBlocked.has(id)));
  // Balances and bookings of this coach's clients are settled by the server from ledger events.
  const settled = settleOwned(
    current,
    { clients: allowedIncoming, bookings: incomingBookings },
    new Set([...oldIds, ...myIds]),
    "trainer",
    notifyRule(current),
    Date.now(),
    (prev, row) => mergeBookingFlags(row, prev),
  );
  myClients = myClients.map((c) => {
    const prev = myOld.find((o) => o.id === c.id);
    // A program imported from the bot after the trainer's copy was read is not overwritten by it.
    const program = programFor(prev, { sessions: c.sessions, programAt: c.programAt });
    // Client-authored fields (measures, consent, streak...) are never taken from a trainer's copy.
    const history = mergeWeightHistory(prev?.weightHistory, c.weightHistory);
    const merged = keepClientOwned(prev, { ...c, ...program, weightHistory: history, weight: weightNow(history, c.weight) });
    // вес — данные о здоровье клиента: тренер пишет его только при действующем согласии клиента
    const owned = healthWriteAllowed(merged.consent)
      ? merged
      : { ...merged, weightHistory: prev?.weightHistory ?? [], weight: prev?.weight ?? 0 };
    const balance: Balance | undefined = settled.balances.get(c.id);
    if (!balance) return owned;
    const packExpiresAt = c.packExpiresAt ?? (prev?.packExpiresAt ?? null);
    return { ...owned, ...balance, packExpiresAt };
  });
  const others = current.clients.filter((c) => clientCoach(c) !== mine);
  const clients = [...others, ...myClients];
  const takeMine = <T extends { clientId: string }>(rows: T[], incomingRows: T[]) => [
    ...rows.filter((row) => !oldIds.has(row.clientId)),
    ...incomingRows.filter((row) => myIds.has(row.clientId)),
  ];
  const keepCoach = (prev: Coach[], incomingRows: Coach[]) =>
    incomingRows.map((next) => {
      const prevRow = prev.find(
        (c) =>
          (next.code && c.code === next.code) ||
          (next.telegramId && c.telegramId === next.telegramId) ||
          sameHandle(c.username, next.username),
      );
      if (!prevRow) return next;
      return {
        ...prevRow,
        ...next,
        addedAt: next.addedAt || prevRow.addedAt,
        paidUntil: next.paidUntil ?? prevRow.paidUntil,
        code: next.code || prevRow.code,
        // отметка уведомлений ведётся сервером: копия тренера не должна вернуть старую
        lastNotice: prevRow.lastNotice ?? null,
      };
    });
  return ensureApprovedClients({
    ...current,
    clients,
    programTemplates: mergeCoachTemplates(current.programTemplates ?? [], incoming.programTemplates ?? [], mine, coachKey),
    bookings: settled.bookings.filter((row) => !oldIds.has(row.clientId) || myIds.has(row.clientId)),
    food: [
      ...current.food.filter((row) => !oldIds.has(row.clientId) || healthBlocked.has(row.clientId)),
      ...(incoming.food ?? []).filter((row) => myIds.has(row.clientId) && !healthBlocked.has(row.clientId)),
    ],
    dayChecks: mergeDayRows(current.dayChecks ?? [], incoming.dayChecks ?? [], healthRowIds),
    menus: mergeMenus(current.menus ?? [], incoming.menus ?? [], healthRowIds),
    lifts: takeMine(current.lifts, incoming.lifts ?? []),
    workoutLogs: takeMine(current.workoutLogs, incoming.workoutLogs ?? []),
    visits: mergeVisits(current.visits ?? [], incoming.visits ?? [], new Set([...oldIds, ...myIds])),
    waitlist: takeMine(current.waitlist, incoming.waitlist ?? []),
    notices: mergeById(
      current.notices.filter((n) => !n.clientId || !oldIds.has(n.clientId)),
      (incoming.notices ?? []).filter((n) => n.clientId && myIds.has(n.clientId)),
    ).slice(0, 40),
    // отметки дня: побеждает более свежая правка (checks-merge.ts), а не копия тренера целиком
    checks: mergeChecks(dropCheckIds(current.checks, new Set([...oldIds].filter((id) => !myIds.has(id)))), incoming.checks ?? {}, myIds),
    joinRequests: mergeById(
      (current.joinRequests ?? []).filter((r) => coachKey(r.coachId) !== mine),
      (incoming.joinRequests ?? [])
        .filter((r) => coachKey(r.coachId) === mine)
        .filter((r) => phase === "trial" || phase === "paid" || (current.joinRequests ?? []).some((old) => old.id === r.id))
        .map((r) => ({ ...r, coachId: mine })),
    ),
    removedClientIds: [...new Set([...(current.removedClientIds ?? []).filter((id) => !myOld.some((c) => isRemovedClient(c, [id]))), ...removed])],
    extraSlots: mergeOwnSlots(current.extraSlots, incoming.extraSlots ?? [], mine),
    closedSlotIds: mergeClosedSlots(current.closedSlotIds, incoming.closedSlotIds ?? [], mergeOwnSlots(current.extraSlots, incoming.extraSlots ?? [], mine), mine),
    coaches:
      mine === String(TRAINER_TG_ID) && Array.isArray(incoming.coaches)
        ? keepCoach(current.coaches ?? [], incoming.coaches)
        : current.coaches ?? [],
    trainerUsername: mine === String(TRAINER_TG_ID) ? incoming.trainerUsername || current.trainerUsername : current.trainerUsername,
    // настройки зала и правила отмены: их пишет тренер, сервер раньше отбрасывал их при каждом сохранении
    notifyPrefs: incoming.notifyPrefs ?? current.notifyPrefs,
    dismissedSignalIds: unionIds(current.dismissedSignalIds, incoming.dismissedSignalIds),
  });
}

function clientKey(c: Client) {
  if (c.telegramId) return `tg:${c.telegramId}`;
  const u = (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
  if (u) return `u:${u}`;
  const p = (c.phone ?? "").replace(/\D/g, "");
  if (p.length >= 10) return `p:${p}`;
  return `id:${c.id}`;
}

export function mergeClients(primary: Client[], secondary: Client[]): Client[] {
  const map = new Map<string, Client>();
  for (const c of primary) map.set(clientKey(c), c);
  for (const c of secondary) {
    const k = clientKey(c);
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, ...c, id: prev.id, telegramId: c.telegramId || prev.telegramId } : c);
  }
  return [...map.values()];
}

export function isRemovedClient(c: Client, removed: string[]) {
  if (!removed.length) return false;
  const dead = new Set(removed);
  if (dead.has(c.id)) return true;
  if (c.telegramId && (dead.has(c.telegramId) || dead.has(`tg:${c.telegramId}`))) return true;
  const u = (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
  if (u && dead.has(`u:${u}`)) return true;
  const p = (c.phone ?? "").replace(/\D/g, "");
  if (p.length >= 10 && dead.has(`p:${p}`)) return true;
  return dead.has(clientKey(c));
}

export function tombstonesFor(c: Client) {
  const keys = [c.id, clientKey(c)];
  if (c.telegramId) keys.push(c.telegramId, `tg:${c.telegramId}`);
  const u = (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
  if (u) keys.push(`u:${u}`);
  const p = (c.phone ?? "").replace(/\D/g, "");
  if (p.length >= 10) keys.push(`p:${p}`);
  return [...new Set(keys)];
}

export function dropTombstones(removed: string[], keys: string[]) {
  const drop = new Set(keys);
  return removed.filter((x) => !drop.has(x));
}

function clientFromJoin(req: JoinRequest): Client {
  return {
    ...emptyClient(),
    id: `tg_${req.telegramId}`,
    firstName: req.firstName || "Клиент",
    lastName: req.lastName || "",
    telegramId: req.telegramId,
    telegramUsername: req.telegramUsername ?? null,
    coachId: coachKey(req.coachId),
  };
}

export function ensureApprovedClients(payload: StudioPayload): StudioPayload {
  const approved = (payload.joinRequests ?? []).filter((r) => r.status === "approved");
  if (!approved.length) return payload;
  let clients = payload.clients;
  let removed = payload.removedClientIds ?? [];
  for (const req of approved) {
    const uname = (req.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
    const existing =
      clients.find((c) => c.telegramId === req.telegramId) ??
      clients.find((c) => uname && (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname);
    if (!existing) clients = [...clients, clientFromJoin(req)];
    else if (!existing.telegramId) {
      clients = clients.map((c) =>
        c.id === existing.id ? { ...c, telegramId: req.telegramId, telegramUsername: req.telegramUsername ?? c.telegramUsername } : c,
      );
    }
    const who = existing ? { ...existing, telegramId: req.telegramId, telegramUsername: req.telegramUsername ?? existing.telegramUsername } : clientFromJoin(req);
    removed = dropTombstones(removed, tombstonesFor(who));
  }
  return { ...payload, clients, removedClientIds: removed };
}

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]));
  for (const x of incoming) map.set(x.id, x);
  return [...map.values()];
}

/** Late-cancel rule as the trainer configured it. Read from the stored payload, never from a sender. */
function notifyRule(current: StudioPayload) {
  return {
    flagLate: current.notifyPrefs?.flagLate ?? true,
    windowHours: current.notifyPrefs?.windowHours ?? 2,
  };
}

/** Erasure by the client: identity replaced, personal logs removed, financial rows kept without the name. */
function eraseClientRows(current: StudioPayload, id: string): StudioPayload {
  const now = new Date().toISOString();
  const keep = <T extends { clientId?: string }>(rows: T[]) => rows.filter((r) => r.clientId !== id);
  return {
    ...current,
    clients: current.clients.map((c) =>
      c.id !== id
        ? c
        : {
            ...c,
            ...anonymizedIdentity(),
            weight: 0,
            weightHistory: [],
            measures: [],
            erasedAt: now,
            consentLog: appendConsentLog(c.consentLog, { version: c.consent?.version ?? "", at: now, action: "erase" }),
          },
    ),
    food: keep(current.food),
    menus: keep(current.menus ?? []),
    dayChecks: keep(current.dayChecks ?? []),
    lifts: keep(current.lifts),
    workoutLogs: keep(current.workoutLogs),
    waitlist: keep(current.waitlist),
    visits: keep(current.visits ?? []),
    notices: [erasureNotice(id, now), ...keep(current.notices)].slice(0, 40),
    checks: Object.fromEntries(Object.entries(current.checks).filter(([k]) => !k.startsWith(`${id}:`))),
  };
}

function mergeClientWrite(current: StudioPayload, incoming: StudioPayload, telegramId: string): StudioPayload {
  const mine = current.clients.find((c) => c.telegramId === telegramId);
  const incomingSelf = incoming.clients.find((c) => c.telegramId === telegramId) ?? incoming.clients[0];
  if (!mine || !incomingSelf) return current;
  if (incomingSelf.erasedAt && !mine.erasedAt) return eraseClientRows(current, mine.id);
  const id = mine.id;
  const now = new Date().toISOString();
  // Balance and bookings are settled by the server from ledger events (see lib/balance.ts).
  const settled = settleOwned(
    current,
    incoming,
    new Set([id]),
    "client",
    notifyRule(current),
    Date.now(),
    (prev, row) =>
      mergeBookingFlags(
        { ...row, reminded24: row.reminded24 || prev.reminded24, reminded2: row.reminded2 || prev.reminded2 },
        prev,
      ),
  );
  const balance = settled.balances.get(id);
  // данные о здоровье клиента пишутся только при действующем согласии (согласие решается по итоговой записи)
  const consent = stampConsent(mine.consent, incomingSelf.consent, now);
  const healthOk = healthWriteAllowed(consent);
  const weights = guardBodyFields(
    healthOk,
    mine.weightHistory,
    mergeWeightHistory(mine.weightHistory, incomingSelf.weightHistory),
  );
  const nextSelf: Client = {
    ...mine,
    weightHistory: weights,
    weight: guardBodyFields(healthOk, mine.weight, weightNow(weights, incomingSelf.weight ?? mine.weight)),
    measures: guardBodyFields(healthOk, mine.measures, mergeMeasures(mine.measures, incomingSelf.measures)),
    consent,
    consentLog: consentLogAfter(mine, incomingSelf.consent, now),
    lastReportAt: incomingSelf.lastReportAt ?? mine.lastReportAt,
    streak: incomingSelf.streak ?? mine.streak,
    ...(balance ?? {}),
  };
  return {
    ...current,
    clients: current.clients.map((c) => (c.id === id ? nextSelf : c)),
    bookings: settled.bookings,
    food: [
      ...current.food.filter((f) => f.clientId !== id),
      ...guardRows(
        healthOk,
        current.food.filter((f) => f.clientId === id),
        incoming.food.filter((f) => f.clientId === id),
      ),
    ],
    dayChecks: guardRows(
      healthOk,
      current.dayChecks ?? [],
      mergeDayRows(current.dayChecks ?? [], incoming.dayChecks ?? [], new Set([id])),
    ),
    // меню дня — данные о здоровье: без согласия клиента не хранятся
    menus: healthOk
      ? applyClientChoices(current.menus ?? [], checkMenus(incoming.menus), id)
      : (current.menus ?? []).filter((m) => m.clientId !== id),
    lifts: [...current.lifts.filter((l) => l.clientId !== id), ...incoming.lifts.filter((l) => l.clientId === id)],
    waitlist: [
      ...current.waitlist.filter((w) => w.clientId !== id),
      ...incoming.waitlist.filter((w) => w.clientId === id),
    ],
    workoutLogs: [
      ...current.workoutLogs.filter((w) => w.clientId !== id),
      ...incoming.workoutLogs.filter((w) => w.clientId === id),
    ],
    checks: mergeChecks(current.checks, incoming.checks ?? {}, new Set([id])),
    visits: mergeVisits(current.visits ?? [], incoming.visits ?? [], new Set([id])),
    dismissedSignalIds: ownDismissed(
      current.dismissedSignalIds ?? [],
      incoming.dismissedSignalIds ?? [],
      current.notices,
      id,
    ),
  };
}

async function normalizedState(raw: Partial<StudioPayload> | null | undefined) {
  const next = normalizePayload(raw);
  const changed = (raw?.clients ?? []).some((client) => {
    const now = next.clients.find((row) => row.id === client.id);
    return Boolean(now && (now.coachId || "") !== (client.coachId || ""));
  });
  const stamped = (raw?.coaches ?? []).some((coach) => !coach.addedAt);
  if (!changed && !stamped) return next;
  try {
    return await saveStudioState(next);
  } catch (err) {
    // housekeeping only: a racing save already moved the row; the next read repeats this step
    if (!(err instanceof StateConflictError)) throw err;
    return next;
  }
}

/**
 * The studio state. Neon is the truth. Errors reach the caller: an empty state returned after a failed
 * read would be saved over the real one, so there is no fallback to an empty state here.
 */
export async function loadStudioState(): Promise<StudioPayload> {
  const db = await import("@/lib/db");
  const sql = await db.getSql();
  if (db.dbSource !== "neon") {
    // local preview without a database: the Telegram copy, as before
    const { loadRemote } = await import("@/lib/studio-remote");
    const remote = await loadRemote();
    return remote ? normalizedState(remote) : emptyPayload();
  }
  const rows = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
  const row = rows[0]?.payload;
  if (row && isRevisioned(row)) return normalizedState(row);
  // A row without a revision predates them. The row is the truth: the Telegram copy is no longer written after a save,
  // so it can be stale and is never preferred over the row. It is read only when no row exists at all (restore).
  const { loadRemoteStrict } = await import("@/lib/studio-remote");
  const copy = row ? null : await loadRemoteStrict();
  const state = await normalizedState(row ?? copy ?? null);
  const first: StudioPayload = { ...state, rev: nextRevision(row) };
  const written = await sql<{ id: string }>`
    insert into studio_state (id, payload, updated_at) values (${STUDIO_ID}, ${JSON.stringify(first)}::jsonb, now())
    on conflict (id) do update set payload = excluded.payload, updated_at = now()
    where coalesce((studio_state.payload->>'rev')::int, 0) = 0
    returning id`;
  if (written.length > 0) return first;
  // another request migrated the row first: its revision is the truth
  const again = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
  return normalizedState(again[0]?.payload);
}

const BACKUP_ID = "ruksha-backup";
let backupFlight: Promise<void> | null = null;

async function readBackupDay() {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ payload: { day?: string } }>`select payload from studio_state where id = ${BACKUP_ID}`;
    return rows[0]?.payload?.day ?? null;
  } catch {
    return null;
  }
}

async function writeBackupDay(day: string) {
  try {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql.query(
      "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
      [BACKUP_ID, JSON.stringify({ day })],
    );
  } catch {
    /* the marker only avoids a repeat digest; losing it sends one extra summary at most */
  }
}

/**
 * Раз в день тренеру уходит сводка. Копия базы в чат не отправляется: резервные копии — у Neon,
 * а выгрузка — по кнопке в приложении (studio-export.ts). Маркер дня прежний, чтобы сводка не ушла дважды при выкладке.
 */
export async function maybeDailyDigest(payload: StudioPayload) {
  if (backupFlight) return backupFlight;
  backupFlight = (async () => {
    const { env } = await import("@/lib/env.server");
    if (!env("BOT_TOKEN")) return;
    const today = backupDay();
    if (!shouldSendBackup(await readBackupDay(), today)) return;
    const { sendMorningNote } = await import("@/lib/studio-remote");
    const { morningSummary } = await import("@/lib/studio-digest");
    const sent = await sendMorningNote(
      morningSummary({
        clients: payload.clients,
        bookings: payload.bookings,
        visits: payload.visits,
        food: payload.food,
        notices: payload.notices,
        today,
        absentDays: payload.notifyPrefs.absentDays || 10,
      }),
    );
    if (sent) await writeBackupDay(today);
  })().finally(() => {
    backupFlight = null;
  });
  return backupFlight;
}

/** Another request saved the studio between this request's read and its write. The caller reads again. */
export class StateConflictError extends Error {
  constructor() {
    super("studio state changed by another request");
    this.name = "StateConflictError";
  }
}

/**
 * Writes the state, then pings due reminders. The write comes first: a reminder is sent only once its
 * mark is committed, so a conflict or a retry here never sends the same reminder twice.
 */
/**
 * Записывает изменение состояния с повтором при гонке: читает свежую копию, применяет `mutate`
 * и пишет условно по ревизии. `mutate` возвращает null, если менять нечего.
 * Итог: "saved" — записано, "unchanged" — менять нечего, "conflict" — три попытки не удались.
 */
export async function updateStudioState(
  mutate: (current: StudioPayload) => StudioPayload | null,
): Promise<RetryOutcome> {
  return retryUpdate({
    load: loadStudioState,
    save: async (next) => {
      await saveStudioState(next);
    },
    mutate,
    isConflict: (err) => err instanceof StateConflictError,
  });
}

export async function saveStudioState(payload: StudioPayload) {
  const stored = await commitStudioState(payload);
  try {
    const { sendDueReminders } = await import("@/lib/telegram-bot.server");
    return await sendDueReminders(stored);
  } catch {
    // a missed ping must not fail the save
    return stored;
  }
}

/** The conditional write alone, without reminders. Throws StateConflictError when the row moved on. */
export async function commitStudioState(payload: StudioPayload) {
  let next = payload;
  const db = await import("@/lib/db");
  if (db.dbSource === "neon") {
    const sql = await db.getSql();
    const expected = readRevision(next);
    const data: StudioPayload = { ...next, rev: expected + 1 };
    // the write lands only if the row still has the revision this state was read with
    const won = await sql<{ id: string }>`
      insert into studio_state (id, payload, updated_at) values (${STUDIO_ID}, ${JSON.stringify(data)}::jsonb, now())
      on conflict (id) do update set payload = excluded.payload, updated_at = now()
      where coalesce((studio_state.payload->>'rev')::int, 0) = ${expected}
      returning id`;
    if (won.length === 0) throw new StateConflictError();
    next = data;
    try {
      for (const visit of next.visits ?? []) {
        await sql.query(
          "insert into visits (id, client_id, date, at, water_ml) values ($1, $2, $3, $4, $5) on conflict (id) do update set water_ml = excluded.water_ml, at = excluded.at",
          [visit.id, visit.clientId, visit.date, visit.at, visit.waterMl],
        );
      }
    } catch (err) {
      console.error("[studio-visits]", err);
    }
  }
  try {
    await maybeDailyDigest(next);
  } catch (err) {
    console.error("[studio-save]", err);
  }
  // the state as stored, with its new revision: a caller that saves again must carry this one
  return next;
}

/** Выдаёт клиенту код приглашения, если его ещё нет. Код уникален и не меняется. */
async function ensureReferralCode(telegramId: string): Promise<StudioPayload | null> {
  let issued = false;
  const outcome = await updateStudioState((current) => {
    const row = current.clients.find((c) => c.telegramId === telegramId);
    if (!row || row.referralCode) return null;
    const used = new Set(current.clients.map((c) => (c.referralCode ?? "").toLowerCase()));
    let code = newReferralCode();
    while (used.has(code)) code = newReferralCode();
    issued = true;
    return { ...current, clients: current.clients.map((c) => (c.id === row.id ? { ...c, referralCode: code } : c)) };
  });
  return outcome === "saved" && issued ? loadStudioState() : null;
}

/** Тренер приглашающего должен быть с действующим доступом; иначе приглашение не принимаем. */
function coachForReferrer(referrer: Client, payload: StudioPayload): string {
  const owner = referrer.coachId || String(TRAINER_TG_ID);
  if (owner === String(TRAINER_TG_ID)) return owner;
  const row = (payload.coaches ?? []).find((c) => c.telegramId === owner);
  if (!row) return String(TRAINER_TG_ID);
  const phase = coachPhase(row);
  return phase === "trial" || phase === "paid" ? owner : "";
}

/**
 * Уведомления о доступе тренеров. Отметка записывается условно (с повтором), и только после неё
 * уходят сообщения в бот: повторное открытие приложения не отправит то же самое дважды.
 * Неотправленное сообщение не повторяется — сигнал владельцу в кабинете остаётся.
 */
async function notifyCoachAccess(payload: StudioPayload): Promise<StudioPayload | null> {
  if (!dueCoachNotices(payload.coaches ?? [], Date.now()).length) return null;
  let due: CoachNotice[] = [];
  const outcome = await updateStudioState((current) => {
    const applied = applyCoachNotices(current, Date.now());
    due = applied?.due ?? [];
    return applied?.next ?? null;
  });
  if (outcome !== "saved") return null;
  try {
    const bot = await import("@/lib/telegram-bot.server");
    for (const n of due) {
      try {
        await bot.sendBotLink(n.telegramId, coachNoticeText(n));
      } catch (err) {
        console.error("[coach-notice]", err);
      }
    }
  } catch (err) {
    console.error("[coach-notice]", err);
  }
  return loadStudioState();
}

export const pullStudio = createServerFn({ method: "POST" })
  .validator(PullInput)
  .handler(async ({ data }): Promise<{ ok: boolean; role?: "trainer" | "client"; payload?: StudioPayload; created?: boolean; blocked?: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    let payload = await loadStudioState();
    try {
      const { sendDueReminders } = await import("@/lib/telegram-bot.server");
      // returns the state as stored, with the reminder marks committed
      payload = await sendDueReminders(payload);
    } catch {
      /* a missed ping must not block the cabinet */
    }
    const bound = bindCoach(payload, session.user);
    if (bound !== payload) {
      payload = bound;
      await saveStudioState(payload);
    }
    // уведомления о доступе: при ошибке кабинет открывается без них
    try {
      payload = (await notifyCoachAccess(payload)) ?? payload;
    } catch (err) {
      console.error("[coach-notice]", err);
    }
    const trainer = isCoachUser(payload, session.user);
    const created = false;

    if (!trainer) {
      // F-22: клиент привязывается только по telegramId. Привязка по @username убрана:
      // handle меняется и может перейти к другому человеку. Новый клиент — через заявку на вступление.
      const byId = payload.clients.some((c) => c.telegramId === session.user.id);
      if (!byId) {
        return {
          ok: true,
          role: "client",
          created: false,
          blocked: true,
          payload: scopePayload(payload, session.user.id),
        };
      }
      // Код уже выдан — ничего не читаем и не пишем лишний раз на каждом обновлении.
      const mine = payload.clients.find((c) => c.telegramId === session.user.id);
      if (mine && !mine.referralCode) {
        try {
          payload = (await ensureReferralCode(session.user.id)) ?? payload;
        } catch (err) {
          console.error("[referral-code]", err);
        }
      }
      return { ok: true, role: "client", created, payload: scopePayload(payload, session.user.id) };
    }

    if (
      session.user.id === String(TRAINER_TG_ID) &&
      session.user.username &&
      payload.trainerUsername !== session.user.username
    ) {
      payload = { ...payload, trainerUsername: session.user.username };
      await saveStudioState(payload);
    }

    return { ok: true, role: "trainer", payload: scopeCoach(payload, session.user.id) };
  });

/** Причина отказа видна клиенту: по ней он понимает, что делать (перезапуск, открыть из бота). */
export type JoinResult = { ok: boolean; already?: boolean; reason?: "session" | "coach" | "consent" };

export const requestJoin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      initData: z.string().optional(),
      offer: z.string().optional(),
      slotId: z.string().optional(),
      goal: z.string().optional(),
      pack: z.string().optional(),
      consentVersion: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<JoinResult> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "session" };
    const bot = await import("@/lib/telegram-bot.server");
    const payload = await loadStudioState();
    if (isCoachUser(payload, session.user)) {
      await bot.ensureBotHook();
      return { ok: true };
    }
    // приглашение клиентом (r_<код>) ведёт к тренеру пригласившего; иначе — обычный путь через тренера
    const referrer = referrerByCode(referralCodeFromStart(session.startParam) ?? "", payload.clients);
    const coachId = referrer ? coachForReferrer(referrer, payload) : coachFromStart(session.startParam, payload);
    if (!coachId) return { ok: false, reason: "coach" };
    // the request goes in only with the policy accepted in its current version; the record goes with it
    // старая сборка приложения шлёт другую версию согласия: просим перезапустить, а не молчим
    if (data.consentVersion !== PRIVACY_VERSION) return { ok: false, reason: "consent" };
    return bot.registerJoin(session.user, {
      message: data.offer ?? "",
      slotId: data.slotId,
      goal: data.goal,
      pack: data.pack,
      coachId,
      referrerId: referrer?.id ?? null,
      consent: { version: PRIVACY_VERSION, at: new Date().toISOString() },
    });
  });

export const decideJoinFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), telegramId: z.string(), approve: z.boolean() }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    const current = await loadStudioState();
    if (!session || !isCoachUser(current, session.user)) return { ok: false };
    const req = (current.joinRequests ?? []).find((r) => r.telegramId === data.telegramId);
    if (!req?.coachId || session.user.id !== req.coachId) return { ok: false };
    if (session.user.id !== String(TRAINER_TG_ID)) {
      const row = coachRow(current, session.user);
      const phase = row ? coachPhase(row) : "expired";
      if (phase !== "trial" && phase !== "paid") return { ok: false };
      if (data.approve && phase === "trial") {
        const count = current.clients.filter((c) => c.coachId === session.user.id).length;
        if (count >= COACH_TRIAL_CAP) return { ok: false };
      }
    }
    const bot = await import("@/lib/telegram-bot.server");
    return bot.decideJoin(data.telegramId, data.approve);
  });

export const sendTrainerNoteFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), text: z.string() }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false };
    const bot = await import("@/lib/telegram-bot.server");
    const res = await bot.sendTrainerNote(
      {
        id: session.user.id,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        username: session.user.username,
      },
      data.text,
    );
    return { ok: Boolean(res.ok) };
  });

export const sendBotLinkFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      initData: z.string().optional(),
      telegramId: z.string().max(20),
      text: z.string().min(1).max(1000),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    const current = await loadStudioState();
    // F-08: только свои клиенты, не на паузе, только числовой id
    if (!session || !canSendBotLinkRule(current, session.user, data.telegramId)) return { ok: false };
    const bot = await import("@/lib/telegram-bot.server");
    const res = await bot.sendClientNotice(data.telegramId, data.text);
    return { ok: Boolean(res.ok) };
  });

export const pushStudio = createServerFn({ method: "POST" })
  .validator(PushInput)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const incoming = (data.payload ?? emptyPayload()) as StudioPayload;
    // Another request may save between this read and this write. Then the push is merged again onto the fresh state.
    for (let attempt = 1; attempt <= 3; attempt++) {
      const current = await loadStudioState();
      const trainer = isCoachUser(current, session.user);
      // F-22: известен только по telegramId; handle для записи не используется
      const known = trainer || current.clients.some((c) => c.telegramId === session.user.id);
      let next: StudioPayload;
      if (trainer) {
        next = mergeCoachPayload(current, normalizePayload(incoming), session.user.id);
      } else if (!known) {
        return { ok: true };
      } else {
        next = mergeClientWrite(current, incoming, session.user.id);
      }
      try {
        await saveStudioState(next);
        return { ok: true };
      } catch (err) {
        if (!(err instanceof StateConflictError)) {
          console.error("[studio-save]", err);
          return { ok: false, reason: "save-failed" };
        }
        // lost the race: the next pass reads the fresh state and merges again
      }
    }
    return { ok: false, reason: "conflict" };
  });

export const addCoachFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), username: z.string(), firstName: z.string() }))
  .handler(async ({ data }): Promise<{ ok: boolean; coaches?: Coach[] }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session || session.user.id !== String(TRAINER_TG_ID)) return { ok: false };
    const username = data.username.replace(/^@/, "").trim().toLowerCase();
    const firstName = data.firstName.trim();
    if (!username || !firstName) return { ok: false };
    let coaches: Coach[] | undefined;
    const outcome = await updateStudioState((current) => {
      if ((current.coaches ?? []).some((c) => sameHandle(c.username, username))) {
        coaches = current.coaches;
        return null;
      }
      const code = Math.random().toString(36).slice(2, 8);
      coaches = [
        ...(current.coaches ?? []),
        { telegramId: null, username, firstName, lastName: "", code, addedAt: new Date().toISOString(), paidUntil: null },
      ];
      return { ...current, coaches };
    });
    if (outcome === "conflict") return { ok: false };
    return { ok: true, coaches };
  });

export const removeCoachFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), username: z.string().optional(), code: z.string().optional(), telegramId: z.string().optional() }))
  .handler(async ({ data }): Promise<{ ok: boolean; coaches?: Coach[] }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session || session.user.id !== String(TRAINER_TG_ID)) return { ok: false };
    let coaches: Coach[] = [];
    const outcome = await updateStudioState((current) => {
      const before = current.coaches ?? [];
      coaches = before.filter((c) => {
        if (data.telegramId && c.telegramId === data.telegramId) return false;
        if (data.code && c.code && c.code === data.code) return false;
        if (data.username && sameHandle(c.username, data.username)) return false;
        return true;
      });
      if (!before.length || coaches.length === before.length) return null;
      const droppedIds = new Set(
        before
          .filter((c) => !coaches.some((left) => left === c || (left.code && left.code === c.code) || (left.telegramId && left.telegramId === c.telegramId)))
          .map((c) => c.telegramId)
          .filter((id): id is string => Boolean(id)),
      );
      const goneClients = current.clients.filter((c) => c.coachId && droppedIds.has(c.coachId));
      const goneIds = new Set(goneClients.map((c) => c.id));
      const dropRow = <T extends { clientId: string }>(rows: T[]) => rows.filter((row) => !goneIds.has(row.clientId));
      return {
        ...current,
        coaches,
        clients: current.clients.filter((c) => !goneIds.has(c.id)),
        bookings: dropRow(current.bookings),
        food: dropRow(current.food),
        dayChecks: dropRow(current.dayChecks ?? []),
        lifts: dropRow(current.lifts),
        workoutLogs: dropRow(current.workoutLogs),
        waitlist: dropRow(current.waitlist),
        notices: current.notices.filter((n) => !n.clientId || !goneIds.has(n.clientId)),
        joinRequests: (current.joinRequests ?? []).filter((r) => !r.coachId || !droppedIds.has(r.coachId)),
        removedClientIds: [...new Set([...(current.removedClientIds ?? []), ...goneClients.flatMap((c) => tombstonesFor(c))])],
      };
    });
    if (outcome !== "saved") return { ok: false };
    return { ok: true, coaches };
  });

export const payCoachFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), username: z.string().optional(), code: z.string().optional(), telegramId: z.string().optional() }))
  .handler(async ({ data }): Promise<{ ok: boolean; coaches?: Coach[]; tierLine?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session || session.user.id !== String(TRAINER_TG_ID)) return { ok: false };
    let coaches: Coach[] = [];
    let load = 0;
    const outcome = await updateStudioState((current) => {
      const idx = (current.coaches ?? []).findIndex(
        (c) =>
          (data.telegramId && c.telegramId === data.telegramId) ||
          (data.code && c.code === data.code) ||
          (data.username && sameHandle(c.username, data.username)),
      );
      if (idx < 0) return null;
      const row = current.coaches[idx];
      const base = Math.max(Date.now(), row.paidUntil ? Date.parse(row.paidUntil) || 0 : 0);
      coaches = current.coaches.slice();
      coaches[idx] = { ...row, paidUntil: new Date(base + COACH_PAID_DAYS * 86_400_000).toISOString() };
      // the amount follows the coach's own client count, which only the server sees in full
      load = row.telegramId ? current.clients.filter((c) => clientCoach(c) === String(row.telegramId)).length : 0;
      return { ...current, coaches };
    });
    if (outcome !== "saved") return { ok: false };
    return { ok: true, coaches, tierLine: coachTierLine(load) };
  });

export const studioHealth = createServerFn({ method: "GET" }).handler(async (): Promise<{ bot: boolean; db: "neon" | "pglite" }> => {
  const { env } = await import("@/lib/env.server");
  const { dbSource } = await import("@/lib/db");
  return { bot: Boolean(env("BOT_TOKEN")), db: dbSource };
});
