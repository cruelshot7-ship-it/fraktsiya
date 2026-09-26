import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  clientCoach,
  coachKey,
  emptyClient,
  hoursAgoIso,
  digitsPhone,
  TRAINER_TG_ID,
  type Booking,
  type Client,
  type Coach,
  type FoodLog,
  type JoinRequest,
  type LiftLog,
  type Notice,
  type NotifyPrefs,
  type Slot,
  type WaitlistEntry,
  type WorkoutLog,
} from "@/data/studio";

export type StudioPayload = {
  bookings: Booking[];
  food: FoodLog[];
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
};

const STUDIO_ID = "ruksha";

const PullInput = z.object({
  initData: z.string().optional(),
  phone: z.string().optional(),
});

const PushInput = z.object({
  initData: z.string().optional(),
  payload: z.any(),
});

export function emptyPayload(): StudioPayload {
  return {
    bookings: [],
    food: [],
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
    },
    waitlist: [],
    workoutLogs: [],
    checks: {},
    trainerUsername: null,
    joinRequests: [],
    removedClientIds: [],
    coaches: [],
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
    lifts: raw.lifts ?? [],
    extraSlots: raw.extraSlots ?? [],
    closedSlotIds: raw.closedSlotIds ?? [],
    dismissedSignalIds: raw.dismissedSignalIds ?? [],
    notices: raw.notices ?? [],
    waitlist: raw.waitlist ?? [],
    workoutLogs: raw.workoutLogs ?? [],
    checks: raw.checks ?? {},
    trainerUsername: raw.trainerUsername ?? null,
    joinRequests: raw.joinRequests ?? [],
    removedClientIds: removed,
    coaches: Array.isArray(raw.coaches) ? raw.coaches : [],
    foreignHolds: undefined,
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
  const id = mine?.id;
  return {
    ...payload,
    clients: mine ? [mine] : [],
    food: id ? payload.food.filter((f) => f.clientId === id) : [],
    lifts: id ? payload.lifts.filter((l) => l.clientId === id) : [],
    workoutLogs: id ? payload.workoutLogs.filter((w) => w.clientId === id) : [],
    notices: id ? payload.notices.filter((n) => n.audience === "client" && n.clientId === id) : [],
    dismissedSignalIds: payload.dismissedSignalIds,
    waitlist: id ? payload.waitlist.filter((w) => w.clientId === id) : [],
    checks: id
      ? Object.fromEntries(Object.entries(payload.checks).filter(([k]) => k.startsWith(`${id}:`)))
      : {},
    trainerUsername: payload.trainerUsername ?? null,
    joinRequests: (payload.joinRequests ?? []).filter((r) => r.telegramId === telegramId),
  };
}

function sameHandle(a: string | null | undefined, b: string | null | undefined) {
  const left = (a ?? "").replace(/^@/, "").trim().toLowerCase();
  const right = (b ?? "").replace(/^@/, "").trim().toLowerCase();
  return Boolean(left) && left === right;
}

export function bindCoach(payload: StudioPayload, user: { id: string; username: string | null; firstName: string; lastName: string }) {
  const coaches = payload.coaches ?? [];
  const idx = coaches.findIndex((c) => c.telegramId === user.id || sameHandle(c.username, user.username));
  if (idx < 0) return payload;
  const row = coaches[idx];
  if (row.telegramId === user.id && row.firstName) return payload;
  const next = coaches.slice();
  next[idx] = {
    ...row,
    telegramId: user.id,
    username: user.username ?? row.username,
    firstName: row.firstName || user.firstName,
    lastName: row.lastName || user.lastName,
  };
  return { ...payload, coaches: next };
}

export function isCoachUser(payload: StudioPayload, user: { id: string; username: string | null }) {
  if (user.id === String(TRAINER_TG_ID)) return true;
  return (payload.coaches ?? []).some((c) => c.telegramId === user.id || sameHandle(c.username, user.username));
}

export function coachFromStart(start: string, payload: StudioPayload) {
  const match = /^c_([a-z0-9]+)$/i.exec((start ?? "").trim());
  if (!match) return "";
  const token = match[1];
  if (token === String(TRAINER_TG_ID)) return String(TRAINER_TG_ID);
  const coach = (payload.coaches ?? []).find((c) => c.code === token || c.telegramId === token);
  return coach?.telegramId ?? "";
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
    lifts: payload.lifts.filter((l) => ids.has(l.clientId)),
    workoutLogs: payload.workoutLogs.filter((w) => ids.has(w.clientId)),
    waitlist: payload.waitlist.filter((w) => ids.has(w.clientId)),
    notices: payload.notices.filter((n) => n.clientId && ids.has(n.clientId)),
    checks: Object.fromEntries(Object.entries(payload.checks).filter(([k]) => [...ids].some((id) => k.startsWith(`${id}:`)))),
    joinRequests: (payload.joinRequests ?? []).filter((r) => coachKey(r.coachId) === mine),
    removedClientIds: payload.removedClientIds ?? [],
    coaches: mine === String(TRAINER_TG_ID) ? payload.coaches ?? [] : [],
    foreignHolds: holds,
  };
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
  const myClients = mergeClients(myOld, incomingMine).filter((c) => !isRemovedClient(c, removed));
  const others = current.clients.filter((c) => clientCoach(c) !== mine);
  const clients = [...others, ...myClients];
  const myIds = new Set(myClients.map((c) => c.id));
  const oldIds = new Set(myOld.map((c) => c.id));
  const takeMine = <T extends { clientId: string }>(rows: T[], incomingRows: T[]) => [
    ...rows.filter((row) => !oldIds.has(row.clientId)),
    ...incomingRows.filter((row) => myIds.has(row.clientId)),
  ];
  return ensureApprovedClients({
    ...current,
    clients,
    bookings: takeMine(current.bookings, incoming.bookings ?? []),
    food: takeMine(current.food, incoming.food ?? []),
    lifts: takeMine(current.lifts, incoming.lifts ?? []),
    workoutLogs: takeMine(current.workoutLogs, incoming.workoutLogs ?? []),
    waitlist: takeMine(current.waitlist, incoming.waitlist ?? []),
    notices: mergeById(
      current.notices.filter((n) => !n.clientId || !oldIds.has(n.clientId)),
      (incoming.notices ?? []).filter((n) => n.clientId && myIds.has(n.clientId)),
    ).slice(0, 40),
    checks: {
      ...Object.fromEntries(Object.entries(current.checks).filter(([k]) => ![...oldIds].some((id) => k.startsWith(`${id}:`)))),
      ...Object.fromEntries(Object.entries(incoming.checks ?? {}).filter(([k]) => [...myIds].some((id) => k.startsWith(`${id}:`)))),
    },
    joinRequests: mergeById(
      (current.joinRequests ?? []).filter((r) => coachKey(r.coachId) !== mine),
      (incoming.joinRequests ?? []).filter((r) => coachKey(r.coachId) === mine).map((r) => ({ ...r, coachId: mine })),
    ),
    removedClientIds: [...new Set([...(current.removedClientIds ?? []).filter((id) => !myOld.some((c) => isRemovedClient(c, [id]))), ...removed])],
    extraSlots: mergeById(current.extraSlots, incoming.extraSlots ?? []),
    closedSlotIds: [...new Set([...current.closedSlotIds, ...(incoming.closedSlotIds ?? [])])],
    coaches:
      mine === String(TRAINER_TG_ID) && Array.isArray(incoming.coaches)
        ? incoming.coaches
        : current.coaches ?? [],
    trainerUsername: mine === String(TRAINER_TG_ID) ? incoming.trainerUsername || current.trainerUsername : current.trainerUsername,
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

function mergeTrainerPayload(current: StudioPayload, incoming: StudioPayload): StudioPayload {
  const removedClientIds = [...new Set([...(current.removedClientIds ?? []), ...(incoming.removedClientIds ?? [])])];
  const aliveIncoming = new Set(incoming.clients.flatMap((c) => tombstonesFor(c)));
  const removed = removedClientIds.filter((id) => !aliveIncoming.has(id));
  const clients = mergeClients(current.clients, incoming.clients).filter((c) => !isRemovedClient(c, removed));
  const live = new Set(clients.map((c) => c.id));
  const merged: StudioPayload = {
    ...incoming,
    removedClientIds: removed,
    clients,
    bookings: mergeById(current.bookings, incoming.bookings).filter((b) => live.has(b.clientId)),
    food: mergeById(current.food, incoming.food).filter((f) => live.has(f.clientId)),
    lifts: mergeById(current.lifts, incoming.lifts).filter((l) => live.has(l.clientId)),
    notices: mergeById(current.notices, incoming.notices).filter((n) => !n.clientId || live.has(n.clientId) || n.audience === "trainer").slice(0, 40),
    waitlist: mergeById(current.waitlist, incoming.waitlist).filter((w) => live.has(w.clientId)),
    workoutLogs: mergeById(current.workoutLogs, incoming.workoutLogs).filter((w) => live.has(w.clientId)),
    extraSlots: mergeById(current.extraSlots, incoming.extraSlots),
    closedSlotIds: [...new Set([...current.closedSlotIds, ...incoming.closedSlotIds])],
    trainerUsername: incoming.trainerUsername || current.trainerUsername,
    joinRequests: mergeById(current.joinRequests ?? [], incoming.joinRequests ?? []),
  };
  return ensureApprovedClients(merged);
}

function mergeClientWrite(current: StudioPayload, incoming: StudioPayload, telegramId: string): StudioPayload {
  const mine = current.clients.find((c) => c.telegramId === telegramId);
  const incomingSelf = incoming.clients.find((c) => c.telegramId === telegramId) ?? incoming.clients[0];
  if (!mine || !incomingSelf) return current;
  const id = mine.id;
  const nextSelf: Client = {
    ...mine,
    weight: incomingSelf.weight ?? mine.weight,
    weightHistory: incomingSelf.weightHistory?.length ? incomingSelf.weightHistory : mine.weightHistory,
    lastReportAt: incomingSelf.lastReportAt ?? mine.lastReportAt,
    streak: incomingSelf.streak ?? mine.streak,
    sessionsLeft: incomingSelf.sessionsLeft ?? mine.sessionsLeft,
    ledger: incomingSelf.ledger ?? mine.ledger,
  };
  return {
    ...current,
    clients: current.clients.map((c) => (c.id === id ? nextSelf : c)),
    bookings: [
      ...current.bookings.filter((b) => b.clientId !== id),
      ...incoming.bookings.filter((b) => b.clientId === id),
    ],
    food: [...current.food.filter((f) => f.clientId !== id), ...incoming.food.filter((f) => f.clientId === id)],
    lifts: [...current.lifts.filter((l) => l.clientId !== id), ...incoming.lifts.filter((l) => l.clientId === id)],
    waitlist: [
      ...current.waitlist.filter((w) => w.clientId !== id),
      ...incoming.waitlist.filter((w) => w.clientId === id),
    ],
    workoutLogs: [
      ...current.workoutLogs.filter((w) => w.clientId !== id),
      ...incoming.workoutLogs.filter((w) => w.clientId === id),
    ],
    checks: {
      ...Object.fromEntries(Object.entries(current.checks).filter(([k]) => !k.startsWith(`${id}:`))),
      ...Object.fromEntries(Object.entries(incoming.checks ?? {}).filter(([k]) => k.startsWith(`${id}:`))),
    },
  };
}

async function normalizedState(raw: Partial<StudioPayload> | null | undefined) {
  const next = normalizePayload(raw);
  const changed = (raw?.clients ?? []).some((client) => {
    const now = next.clients.find((row) => row.id === client.id);
    return Boolean(now && (now.coachId || "") !== (client.coachId || ""));
  });
  if (changed) await saveStudioState(next);
  return next;
}

export async function loadStudioState(): Promise<StudioPayload> {
  const { loadRemote } = await import("@/lib/studio-remote");
  const remote = await loadRemote();
  if (remote) return normalizedState(remote);
  try {
    const { getSql, dbSource } = await import("@/lib/db");
    if (dbSource !== "neon") return emptyPayload();
    const sql = await getSql();
    const rows = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
    return normalizedState(rows[0]?.payload);
  } catch {
    return emptyPayload();
  }
}

export async function saveStudioState(payload: StudioPayload) {
  const { saveRemote } = await import("@/lib/studio-remote");
  await saveRemote(payload);
  try {
    const { getSql, dbSource } = await import("@/lib/db");
    if (dbSource !== "neon") return;
    const sql = await getSql();
    await sql.query(
      "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
      [STUDIO_ID, JSON.stringify(payload)],
    );
  } catch {
    /* ignore */
  }
}

export const pullStudio = createServerFn({ method: "POST" })
  .validator(PullInput)
  .handler(async ({ data }): Promise<{ ok: boolean; role?: "trainer" | "client"; payload?: StudioPayload; created?: boolean; blocked?: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    let payload = await loadStudioState();
    const bound = bindCoach(payload, session.user);
    if (bound !== payload) {
      payload = bound;
      await saveStudioState(payload);
    }
    const trainer = isCoachUser(payload, session.user);
    let created = false;

    if (!trainer) {
      const byId = payload.clients.some((c) => c.telegramId === session.user.id);
      const uname = (session.user.username ?? "").replace(/^@/, "").trim().toLowerCase();
      const byName = uname
        ? payload.clients.find((c) => (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname)
        : undefined;
      const wantPhone = digitsPhone(data.phone);
      const byPhone =
        wantPhone.length >= 10
          ? payload.clients.find((c) => digitsPhone(c.phone).endsWith(wantPhone.slice(-10)))
          : undefined;
      const match = byName ?? byPhone;
      if (!byId && match) {
        payload = {
          ...payload,
          clients: payload.clients.map((c) =>
            c.id === match.id ? { ...c, telegramId: session.user.id, telegramUsername: session.user.username } : c,
          ),
        };
        await saveStudioState(payload);
      } else if (!byId) {
        return {
          ok: true,
          role: "client",
          created: false,
          blocked: true,
          payload: scopePayload(payload, session.user.id),
        };
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

export const requestJoin = createServerFn({ method: "POST" })
  .validator(
    z.object({
      initData: z.string().optional(),
      offer: z.string().optional(),
      slotId: z.string().optional(),
      goal: z.string().optional(),
      pack: z.string().optional(),
    }),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; already?: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false };
    const bot = await import("@/lib/telegram-bot.server");
    const payload = await loadStudioState();
    if (isCoachUser(payload, session.user)) {
      await bot.ensureBotHook();
      return { ok: true };
    }
    const coachId = coachFromStart(session.startParam, payload);
    if (!coachId) return { ok: false };
    return bot.registerJoin(session.user, {
      message: data.offer ?? "",
      slotId: data.slotId,
      goal: data.goal,
      pack: data.pack,
      coachId,
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
  .validator(z.object({ initData: z.string().optional(), telegramId: z.string(), text: z.string() }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    const current = await loadStudioState();
    if (!session || !isCoachUser(current, session.user)) return { ok: false };
    const bot = await import("@/lib/telegram-bot.server");
    const res = await bot.sendBotLink(data.telegramId, data.text);
    return { ok: Boolean(res.ok) };
  });

export const pushStudio = createServerFn({ method: "POST" })
  .validator(PushInput)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const incoming = (data.payload ?? emptyPayload()) as StudioPayload;
    const current = await loadStudioState();
    const trainer = isCoachUser(current, session.user);
    const uname = (session.user.username ?? "").replace(/^@/, "").trim().toLowerCase();
    const known =
      trainer ||
      current.clients.some((c) => c.telegramId === session.user.id) ||
      Boolean(
        uname &&
          current.clients.some((c) => (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname),
      );
    let next: StudioPayload;
    if (trainer) {
      next = mergeCoachPayload(current, normalizePayload(incoming), session.user.id);
    } else if (!known) {
      return { ok: true };
    } else {
      let bound = current;
      if (!current.clients.some((c) => c.telegramId === session.user.id) && uname) {
        const byName = current.clients.find(
          (c) => (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname,
        );
        if (byName) {
          bound = {
            ...current,
            clients: current.clients.map((c) =>
              c.id === byName.id ? { ...c, telegramId: session.user.id, telegramUsername: session.user.username } : c,
            ),
          };
        }
      }
      next = mergeClientWrite(bound, incoming, session.user.id);
    }

    await saveStudioState(next);
    return { ok: true };
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
    const current = await loadStudioState();
    if ((current.coaches ?? []).some((c) => sameHandle(c.username, username))) return { ok: true, coaches: current.coaches };
    const code = Math.random().toString(36).slice(2, 8);
    const coaches = [...(current.coaches ?? []), { telegramId: null, username, firstName, lastName: "", code }];
    await saveStudioState({ ...current, coaches });
    return { ok: true, coaches };
  });

export const removeCoachFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), username: z.string().optional(), code: z.string().optional(), telegramId: z.string().optional() }))
  .handler(async ({ data }): Promise<{ ok: boolean; coaches?: Coach[] }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session || session.user.id !== String(TRAINER_TG_ID)) return { ok: false };
    const current = await loadStudioState();
    const before = current.coaches ?? [];
    const coaches = before.filter((c) => {
      if (data.telegramId && c.telegramId === data.telegramId) return false;
      if (data.code && c.code && c.code === data.code) return false;
      if (data.username && sameHandle(c.username, data.username)) return false;
      return true;
    });
    if (!before.length || coaches.length === before.length) return { ok: false };
    await saveStudioState({ ...current, coaches });
    return { ok: true, coaches };
  });

export const studioHealth = createServerFn({ method: "GET" }).handler(async (): Promise<{ bot: boolean; db: "neon" | "pglite" }> => {
  const { env } = await import("@/lib/env.server");
  const { dbSource } = await import("@/lib/db");
  return { bot: Boolean(env("BOT_TOKEN")), db: dbSource };
});
