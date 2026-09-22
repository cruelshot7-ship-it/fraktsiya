import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  emptyClient,
  hoursAgoIso,
  type Booking,
  type Client,
  type FoodLog,
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
  .handler(async ({ data }): Promise<{ ok: boolean; role?: "trainer" | "client"; payload?: StudioPayload; created?: boolean; reason?: string }> => {
    const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
    const session = verifyTelegramInitData(data.initData);
    if (!session) return { ok: false, reason: "no-telegram" };

    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ payload: StudioPayload }>`select payload from studio_state where id = ${STUDIO_ID}`;
    let payload = rows[0]?.payload ?? emptyPayload();
    let created = false;

    if (session.role === "client") {
      const exists = payload.clients.some((c) => c.telegramId === session.user.id);
      if (!exists) {
        const fresh = clientFromTelegram(session.user);
        const notice: Notice = {
          id: `nt_new_${session.user.id}`,
          audience: "trainer",
          clientId: fresh.id,
          kind: "alert",
          title: `Новый клиент: ${fresh.firstName} ${fresh.lastName}`.trim(),
          body: session.user.username
            ? `@${session.user.username} открыл Mini App. Начислите пакет.`
            : "Открыл Mini App. Начислите пакет и заполните программу.",
          at: hoursAgoIso(0),
        };
        payload = {
          ...payload,
          clients: [...payload.clients, fresh],
          notices: [notice, ...payload.notices].slice(0, 40),
        };
        created = true;
        await sql.query(
          "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
          [STUDIO_ID, JSON.stringify(payload)],
        );
      }
      return { ok: true, role: "client", created, payload: scopePayload(payload, session.user.id) };
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
    const current = rows[0]?.payload ?? emptyPayload();
    const next = session.role === "trainer" ? incoming : mergeClientWrite(current, incoming, session.user.id);

    await sql.query(
      "insert into studio_state (id, payload, updated_at) values ($1, $2::jsonb, now()) on conflict (id) do update set payload = excluded.payload, updated_at = now()",
      [STUDIO_ID, JSON.stringify(next)],
    );
    return { ok: true };
  });
