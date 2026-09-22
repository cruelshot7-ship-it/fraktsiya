import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  emptyClient,
  hoursAgoIso,
  INVITE_CODE,
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
};

const STUDIO_ID = "ruksha";

const PullInput = z.object({
  initData: z.string().optional(),
});

const PushInput = z.object({
  initData: z.string().optional(),
  payload: z.any(),
});

function emptyPayload(): StudioPayload {
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

function mergeById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
  const map = new Map(base.map((x) => [x.id, x]));
  for (const x of incoming) map.set(x.id, x);
  return [...map.values()];
}

function mergeTrainerPayload(current: StudioPayload, incoming: StudioPayload): StudioPayload {
  return {
    ...incoming,
    clients: mergeClients(current.clients, incoming.clients),
    bookings: mergeById(current.bookings, incoming.bookings),
    food: mergeById(current.food, incoming.food),
    lifts: mergeById(current.lifts, incoming.lifts),
    notices: mergeById(current.notices, incoming.notices).slice(0, 40),
    waitlist: mergeById(current.waitlist, incoming.waitlist),
    workoutLogs: mergeById(current.workoutLogs, incoming.workoutLogs),
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

export const pullStudio = createServerFn({ method: "POST" })
  .validator(PullInput)
  .handler(async ({ data }): Promise<{ ok: boolean; role?: "trainer" | "client"; payload?: StudioPayload; created?: boolean; blocked?: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
    let payload = normalizePayload(rows[0]?.payload);
    let created = false;

    if (session.role === "client") {
      const byId = payload.clients.some((c) => c.telegramId === session.user.id);
      const uname = (session.user.username ?? "").replace(/^@/, "").trim().toLowerCase();
      const byName = uname
        ? payload.clients.find((c) => (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname)
        : undefined;
      if (!byId && byName) {
        payload = {
          ...payload,
          clients: payload.clients.map((c) =>
            c.id === byName.id ? { ...c, telegramId: session.user.id, telegramUsername: session.user.username } : c,
          ),
        };
        await sql.query(
          "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
          [STUDIO_ID, JSON.stringify(payload)],
        );
      } else if (!byId && session.startParam.trim().toLowerCase() === INVITE_CODE.toLowerCase()) {
        const fresh = clientFromTelegram(session.user);
        const notice: Notice = {
          id: `nt_new_${session.user.id}`,
          audience: "trainer",
          clientId: fresh.id,
          kind: "alert",
          title: `Новый клиент: ${fresh.firstName} ${fresh.lastName}`.trim(),
          body: session.user.username
            ? `@${session.user.username} пришёл по вашей ссылке. Назначьте пакет.`
            : "Пришёл по ссылке. Назначьте пакет и программу.",
          at: hoursAgoIso(0),
        };
        payload = {
          ...payload,
          clients: [...payload.clients, fresh],
          joinRequests: payload.joinRequests.filter((r) => r.telegramId !== session.user.id),
          notices: [notice, ...payload.notices].slice(0, 40),
        };
        created = true;
        await sql.query(
          "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
          [STUDIO_ID, JSON.stringify(payload)],
        );
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
      await sql.query(
        "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
        [STUDIO_ID, JSON.stringify(payload)],
      );
    }

    return { ok: true, role: "trainer", payload };
  });

export const pushStudio = createServerFn({ method: "POST" })
  .validator(PushInput)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const incoming = (data.payload ?? emptyPayload()) as StudioPayload;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
    const current = normalizePayload(rows[0]?.payload);
    const known =
      session.role === "trainer" ||
      current.clients.some((c) => c.telegramId === session.user.id);
    let next: StudioPayload;
    if (session.role === "trainer") {
      next = mergeTrainerPayload(current, normalizePayload(incoming));
    } else if (!known) {
      const req = (incoming.joinRequests ?? []).find((r) => r.telegramId === session.user.id);
      const prev = current.joinRequests.find((r) => r.telegramId === session.user.id);
      if (prev?.status === "approved") return { ok: true };
      const saved = pendingVisit(session.user, req?.message || prev?.message);
      const notice: Notice = {
        id: `nt_join_${session.user.id}`,
        audience: "trainer",
        clientId: saved.id,
        kind: "join",
        title: `Заявка: ${saved.firstName} ${saved.lastName}`.trim(),
        body: saved.message,
        at: saved.at,
      };
      next = {
        ...current,
        joinRequests: [saved, ...current.joinRequests.filter((r) => r.telegramId !== session.user.id)],
        notices: prev ? current.notices : [notice, ...current.notices].slice(0, 40),
      };
    } else {
      next = mergeClientWrite(current, incoming, session.user.id);
    }

    await sql.query(
      "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
      [STUDIO_ID, JSON.stringify(next)],
    );
    return { ok: true };
  });

export const studioHealth = createServerFn({ method: "GET" }).handler(async (): Promise<{ bot: boolean; db: "neon" | "pglite" }> => {
  const { env } = await import("@/lib/env.server");
  const { dbSource } = await import("@/lib/db");
  return { bot: Boolean(env("BOT_TOKEN")), db: dbSource };
});
