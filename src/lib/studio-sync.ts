import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  emptyClient,
  hoursAgoIso,
  digitsPhone,
  type Booking,
  type Client,
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
  };
}

function normalizePayload(raw: Partial<StudioPayload> | null | undefined): StudioPayload {
  const empty = emptyPayload();
  if (!raw || typeof raw !== "object") return empty;
  return {
    ...empty,
    ...raw,
    bookings: raw.bookings ?? [],
    food: raw.food ?? [],
    lifts: raw.lifts ?? [],
    clients: raw.clients ?? [],
    extraSlots: raw.extraSlots ?? [],
    closedSlotIds: raw.closedSlotIds ?? [],
    dismissedSignalIds: raw.dismissedSignalIds ?? [],
    notices: raw.notices ?? [],
    waitlist: raw.waitlist ?? [],
    workoutLogs: raw.workoutLogs ?? [],
    checks: raw.checks ?? {},
    trainerUsername: raw.trainerUsername ?? null,
    joinRequests: raw.joinRequests ?? [],
    removedClientIds: raw.removedClientIds ?? [],
    clients: (raw.clients ?? []).filter((c) => !isRemovedClient(c, raw.removedClientIds ?? [])),
  };
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
  return {
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

export async function loadStudioState(): Promise<StudioPayload> {
  const { loadRemote } = await import("@/lib/studio-remote");
  const remote = await loadRemote();
  if (remote) return normalizePayload(remote);
  try {
    const { getSql, dbSource } = await import("@/lib/db");
    if (dbSource !== "neon") return emptyPayload();
    const sql = await getSql();
    const rows = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
    return normalizePayload(rows[0]?.payload);
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
    let created = false;

    if (session.role === "client") {
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

    if (session.user.username && payload.trainerUsername !== session.user.username) {
      payload = { ...payload, trainerUsername: session.user.username };
      await saveStudioState(payload);
    }

    return { ok: true, role: "trainer", payload };
  });

export const requestJoin = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional() }))
  .handler(async ({ data }): Promise<{ ok: boolean; already?: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false };
    const bot = await import("@/lib/telegram-bot.server");
    if (session.role === "trainer") {
      await bot.ensureBotHook();
      return { ok: true };
    }
    return bot.registerJoin(session.user);
  });

export const decideJoinFn = createServerFn({ method: "POST" })
  .validator(z.object({ initData: z.string().optional(), telegramId: z.string(), approve: z.boolean() }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session || session.role !== "trainer") return { ok: false };
    const bot = await import("@/lib/telegram-bot.server");
    return bot.decideJoin(data.telegramId, data.approve);
  });

export const pushStudio = createServerFn({ method: "POST" })
  .validator(PushInput)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const incoming = (data.payload ?? emptyPayload()) as StudioPayload;
    const current = await loadStudioState();
    const uname = (session.user.username ?? "").replace(/^@/, "").trim().toLowerCase();
    const known =
      session.role === "trainer" ||
      current.clients.some((c) => c.telegramId === session.user.id) ||
      Boolean(
        uname &&
          current.clients.some((c) => (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname),
      );
    let next: StudioPayload;
    if (session.role === "trainer") {
      next = mergeTrainerPayload(current, normalizePayload(incoming));
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

export const studioHealth = createServerFn({ method: "GET" }).handler(async (): Promise<{ bot: boolean; db: "neon" | "pglite" }> => {
  const { env } = await import("@/lib/env.server");
  const { dbSource } = await import("@/lib/db");
  return { bot: Boolean(env("BOT_TOKEN")), db: dbSource };
});
