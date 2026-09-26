import { create } from "zustand";
import {
  BOT_USERNAME,
  addDays,
  DEFAULT_NOTIFY,
  DOW,
  emptyClient,
  firstBookableDate,
  applyOfferBooking,
  digitsPhone,
  importClientPass,
  formatDayMonth,
  formatLongDate,
  generateWindow,
  hoursAgoIso,
  hoursUntilLabel,
  hoursUntilSlot,
  isoDate,
  isFrozen,
  isLateCancel,
  isSlotPast,
  MEALS,
  PACK_VALID_DAYS,
  parseISODate,
  sessionsRu,
  shortName,
  startOfWeek,
  type Booking,
  type Client,
  type FoodLog,
  type JoinRequest,
  type LiftLog,
  type Meal,
  type Notice,
  type NotifyPrefs,
  type SessionTxn,
  type Slot,
  type WaitlistEntry,
  type WorkoutLog,
  workoutKcal,
  TRAINER_TG_ID,
  type Coach,
} from "@/data/studio";

import { hapticNotify } from "@/lib/haptics";
import { applyTelegramIdentity, scheduleCloudPush, syncFromCloud, telegramLocked } from "@/lib/studio-identity";
import { addCoachFn, decideJoinFn, dropTombstones, ensureApprovedClients, isRemovedClient, mergeClients, requestJoin, sendBotLinkFn, tombstonesFor } from "@/lib/studio-sync";
import { stripDemoData } from "@/lib/studio-clean";
import { getTelegramInitData, getTelegramUser } from "@/lib/telegram";

export type TabId = "slots" | "bookings" | "program" | "food" | "hall" | "clients" | "signals";
export type Role = "client" | "trainer";
export type ClientFilter = "all" | "attention" | "today";

type PersistShape = {
  bookings: Booking[];
  food: FoodLog[];
  lifts: LiftLog[];
  role: Role;
  clients: Client[];
  activeClientId: string;
  extraSlots: Slot[];
  closedSlotIds: string[];
  dismissedSignalIds: string[];
  notices: Notice[];
  notifyPrefs: NotifyPrefs;
  waitlist: WaitlistEntry[];
  workoutLogs: WorkoutLog[];
  checks: Record<string, string[]>;
  trainerUsername?: string | null;
  joinRequests?: JoinRequest[];
  removedClientIds?: string[];
  coaches?: Coach[];
};

type State = {
  ready: boolean;
  role: Role;
  tab: TabId;
  weekStart: string;
  selectedDate: string;
  selectedSlotId: string | null;
  sheetClientId: string | null;
  clientFilter: ClientFilter;
  slots: Slot[];
  extraSlots: Slot[];
  closedSlotIds: string[];
  bookings: Booking[];
  food: FoodLog[];
  lifts: LiftLog[];
  clients: Client[];
  activeClientId: string;
  notices: Notice[];
  dismissedSignalIds: string[];
  notifyPrefs: NotifyPrefs;
  waitlist: WaitlistEntry[];
  workoutLogs: WorkoutLog[];
  checks: Record<string, string[]>;
  trainerUsername: string | null;
  joinRequests: JoinRequest[];
  removedClientIds: string[];
  coaches: Coach[];
  inviteBlocked: boolean;
  noteOpen: boolean;
  guestPreview: boolean;
  toast: string | null;
  hydrate: () => void;
  refreshCloud: () => void;
  sendJoinRequest: (message: string, extra?: { slotId?: string; goal?: string; pack?: string }) => void;
  approveJoin: (id: string) => void;
  rejectJoin: (id: string) => void;
  addCoach: (username: string, firstName: string) => Promise<void>;
  setTab: (tab: TabId) => void;
  setRole: (role: Role) => void;
  setActiveClient: (id: string) => void;
  openClientSheet: (id: string | null) => void;
  setClientFilter: (filter: ClientFilter) => void;
  shiftWeek: (dir: number) => void;
  selectDay: (iso: string) => void;
  bookSlot: (id: string, forClientId?: string) => boolean;
  joinWaitlist: (slotId: string) => void;
  leaveWaitlist: (slotId: string) => void;
  checkIn: (bookingId: string) => void;
  markNoShow: (bookingId: string) => void;
  creditSessions: (clientId: string, amount: number) => void;
  freezeClient: (clientId: string, days: number) => void;
  unfreezeClient: (clientId: string) => void;
  cancelBooking: (id: string, by?: Role) => void;
  cancelSlotBookings: (slotId: string) => void;
  rescheduleBooking: (id: string, newSlotId: string) => boolean;
  addFood: (mealId: string) => void;
  addCustomFood: (meal: Omit<Meal, "id">) => void;
  removeFood: (logId: string) => void;
  addLift: (exercise: string, weight: number, reps: number, sets: number) => void;
  toggleCheck: (item: string) => void;
  completeWorkout: (totalItems: number, minutes?: number, startedAt?: string, extraVolume?: number) => void;
  setWeight: (kg: number) => void;
  addSlot: (date: string, time: string, capacity: number) => void;
  closeSlot: (id: string) => void;
  openSlot: (id: string) => void;
  deleteSlot: (id: string) => void;
  addClient: (draft: { firstName: string; lastName: string; telegramUsername?: string; phone?: string }) => string;
  claimByPhone: (phone: string) => Promise<boolean>;
  removeClient: (id: string) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  dismissSignal: (id: string) => void;
  setNotifyPrefs: (patch: Partial<NotifyPrefs>) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
  openNote: () => void;
  closeNote: () => void;
  openGuestPreview: () => void;
  closeGuestPreview: () => void;
};

const KEY = "ruksha:v8";
const LEGACY_KEYS = ["ruksha:v7", "fraktsiya:v7", "fraktsiya:v6", "fraktsiya:v5"];
const todayIso = () => isoDate(new Date());

function readPersist(): string | null {
  try {
    const fresh = localStorage.getItem(KEY);
    if (fresh) return fresh;
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw) {
        localStorage.setItem(KEY, raw);
        return raw;
      }
    }
  } catch {
    /* private mode */
  }
  return null;
}

function persist(s: PersistShape, push = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
  if (push) scheduleCloudPush(s);
}

function snap(s: State): PersistShape {
  return {
    bookings: s.bookings,
    food: s.food,
    lifts: s.lifts,
    role: s.role,
    clients: s.clients,
    activeClientId: s.activeClientId,
    extraSlots: s.extraSlots,
    closedSlotIds: s.closedSlotIds,
    dismissedSignalIds: s.dismissedSignalIds,
    notices: s.notices,
    notifyPrefs: s.notifyPrefs,
    waitlist: s.waitlist,
    workoutLogs: s.workoutLogs,
    checks: s.checks,
    trainerUsername: s.trainerUsername,
    joinRequests: s.joinRequests,
    removedClientIds: s.removedClientIds,
    coaches: s.coaches,
  };
}

function mergeExtraSlots(a: Slot[], b: Slot[]) {
  const map = new Map(a.map((s) => [s.id, s]));
  for (const s of b) map.set(s.id, s);
  return [...map.values()];
}

let slotHolds: Record<string, number> = {};

function mergeSlots(extra: Slot[]) {
  const base = generateWindow(startOfWeek(new Date()), 42);
  const map = new Map(base.map((s) => [s.id, s]));
  for (const slot of extra) map.set(slot.id, slot);
  return [...map.values()]
    .map((slot) => {
      const hold = slotHolds[slot.id] ?? 0;
      return hold ? { ...slot, seeded: slot.seeded + hold } : slot;
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function mergeByIdLocal<T extends { id: string }>(a: T[], b: T[]) {
  const map = new Map(a.map((x) => [x.id, x]));
  for (const x of b) map.set(x.id, x);
  return [...map.values()];
}

function pingClient(telegramId: string | null | undefined, text: string) {
  const initData = getTelegramInitData();
  if (!initData || !telegramId) return;
  void sendBotLinkFn({ data: { initData, telegramId, text } }).catch(() => undefined);
}

let slotBusy = false;

function mergeJoin(base: JoinRequest[], incoming: JoinRequest[]) {
  const map = new Map(base.map((x) => [x.id, x]));
  for (const x of incoming) map.set(x.id, x);
  return [...map.values()];
}

function makeTxn(
  clientId: string,
  kind: SessionTxn["kind"],
  delta: number,
  note: string,
  bookingId?: string,
): SessionTxn {
  return {
    id: `tx_${Date.now()}_${kind}_${clientId}`,
    clientId,
    kind,
    delta,
    at: new Date().toISOString(),
    note,
    bookingId,
  };
}

function withTxn(clients: Client[], txn: SessionTxn): Client[] {
  return clients.map((c) => {
    if (c.id !== txn.clientId) return c;
    return {
      ...c,
      sessionsLeft: Math.max(0, (c.sessionsLeft ?? 0) + txn.delta),
      ledger: [txn, ...(c.ledger ?? [])].slice(0, 40),
    };
  });
}

function occupancy(slot: Slot, bookings: Booking[]) {
  return Math.min(slot.capacity, slot.seeded + bookings.filter((b) => b.slotId === slot.id).length);
}

export function slotTaken(slot: Slot, bookings: Booking[]) {
  return occupancy(slot, bookings);
}

export function activeClient(s: Pick<State, "clients" | "activeClientId">) {
  return s.clients.find((c) => c.id === s.activeClientId) ?? s.clients[0];
}

function pushNotice(list: Notice[], notice: Notice) {
  return [notice, ...list].slice(0, 40);
}

export const useStudio = create<State>((set, get) => ({
  ready: false,
  role: "client",
  tab: "slots",
  weekStart: isoDate(startOfWeek(parseISODate(firstBookableDate()))),
  selectedDate: firstBookableDate(),
  selectedSlotId: null,
  sheetClientId: null,
  clientFilter: "all",
  slots: generateWindow(startOfWeek(new Date()), 42),
  extraSlots: [],
  closedSlotIds: [],
  bookings: [],
  food: [],
  lifts: [],
  clients: [],
  activeClientId: "",
  notices: [],
  dismissedSignalIds: [],
  notifyPrefs: DEFAULT_NOTIFY,
  waitlist: [],
  workoutLogs: [],
  checks: {},
  trainerUsername: null,
  joinRequests: [],
  removedClientIds: [],
  coaches: [],
  inviteBlocked: false,
  noteOpen: false,
  guestPreview: false,
  toast: null,

  hydrate: () => {
    let bookings: Booking[] = [];
    let food: FoodLog[] = [];
    let lifts: LiftLog[] = [];
    let role: Role = "client";
    let clients: Client[] = [];
    let activeClientId = "";
    let extraSlots: Slot[] = [];
    let closedSlotIds: string[] = [];
    let dismissedSignalIds: string[] = [];
    let notices: Notice[] = [];
    let notifyPrefs: NotifyPrefs = DEFAULT_NOTIFY;
    let waitlist: WaitlistEntry[] = [];
    let workoutLogs: WorkoutLog[] = [];
    let checks: Record<string, string[]> = {};
    let trainerUsername: string | null = null;
    let joinRequests: JoinRequest[] = [];
    let removedClientIds: string[] = [];
    let coaches: Coach[] = [];
    try {
      const raw = readPersist();
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistShape>;
        bookings = parsed.bookings ?? [];
        food = parsed.food ?? [];
        lifts = parsed.lifts ?? [];
        role = parsed.role === "trainer" ? "trainer" : "client";
        clients = parsed.clients?.length
          ? parsed.clients.map((c) => ({
              ...emptyClient(),
              ...c,
              weightHistory: c.weightHistory?.length ? c.weightHistory : emptyClient().weightHistory,
              lateCancels: c.lateCancels ?? 0,
              sessionsLeft: c.sessionsLeft ?? 0,
              ledger: c.ledger ?? [],
              frozenUntil: c.frozenUntil ?? null,
              packExpiresAt: c.packExpiresAt ?? null,
            }))
          : [];
        extraSlots = parsed.extraSlots ?? [];
        closedSlotIds = parsed.closedSlotIds ?? [];
        dismissedSignalIds = parsed.dismissedSignalIds ?? [];
        notices = parsed.notices ?? [];
        notifyPrefs = { ...DEFAULT_NOTIFY, ...parsed.notifyPrefs };
        waitlist = parsed.waitlist ?? [];
        workoutLogs = parsed.workoutLogs ?? [];
        checks = parsed.checks ?? {};
        trainerUsername = parsed.trainerUsername ?? null;
        joinRequests = parsed.joinRequests ?? [];
        removedClientIds = parsed.removedClientIds ?? [];
        coaches = parsed.coaches ?? [];
        const cleaned = stripDemoData({
          clients,
          bookings,
          food,
          lifts,
          notices,
          waitlist,
          workoutLogs,
        });
        clients = cleaned.clients;
        bookings = cleaned.bookings;
        food = cleaned.food;
        lifts = cleaned.lifts;
        notices = cleaned.notices;
        waitlist = cleaned.waitlist;
        workoutLogs = cleaned.workoutLogs;
        clients = clients.filter((c) => !isRemovedClient(c, removedClientIds));
        activeClientId =
          parsed.activeClientId && clients.some((c) => c.id === parsed.activeClientId)
            ? parsed.activeClientId
            : clients[0]?.id ?? "";
      }
    } catch {
      /* keep defaults */
    }
    const identified = applyTelegramIdentity({ clients, activeClientId, role, notices });
    clients = identified.clients;
    activeClientId = identified.activeClientId;
    role = identified.role;
    notices = identified.notices;
    const inviteBlocked = identified.inviteBlocked;
    if (role === "trainer") {
      const handle = getTelegramUser()?.username;
      if (handle) trainerUsername = handle;
    }
    const selectedDate = role === "trainer" ? todayIso() : firstBookableDate();
    set({
      ready: true,
      slots: mergeSlots(extraSlots),
      extraSlots,
      closedSlotIds,
      weekStart: isoDate(startOfWeek(parseISODate(selectedDate))),
      selectedDate,
      bookings,
      food,
      lifts,
      role,
      clients,
      activeClientId,
      notices,
      dismissedSignalIds,
      notifyPrefs,
      waitlist,
      workoutLogs,
      checks,
      trainerUsername,
      joinRequests,
      removedClientIds,
      coaches,
      inviteBlocked,
      tab: role === "trainer" ? "clients" : "slots",
    });
    void syncFromCloud().then((cloud) => {
      if (!cloud) return;
      const payload = cloud.payload;
      slotHolds = payload.foreignHolds ?? {};
      const extra = mergeExtraSlots(get().extraSlots, payload.extraSlots ?? []);
      const joined = cloud.role === "trainer" ? payload.joinRequests ?? [] : mergeJoin(get().joinRequests, payload.joinRequests ?? []);
      const localFresh =
        cloud.role === "trainer"
          ? get().clients.filter((c) => c.id.startsWith("c_") && !(payload.clients ?? []).some((row) => row.id === c.id))
          : [];
      const seed = cloud.blocked
        ? get().clients
        : cloud.role === "trainer"
          ? [...(payload.clients ?? []), ...localFresh]
          : mergeClients(get().clients, payload.clients);
      const next = ensureApprovedClients({
        ...payload,
        clients: seed,
        joinRequests: joined,
        removedClientIds: cloud.role === "trainer" ? payload.removedClientIds ?? [] : get().removedClientIds ?? [],
      });
      set({
        role: cloud.role,
        inviteBlocked: Boolean(cloud.blocked) && !next.clients.length,
        removedClientIds: next.removedClientIds,
        clients: next.clients,
        coaches: payload.coaches ?? [],
        activeClientId:
          cloud.role === "client" && next.clients[0]
            ? next.clients[0].id
            : get().activeClientId,
        bookings: cloud.role === "trainer" ? payload.bookings ?? [] : mergeByIdLocal(get().bookings, payload.bookings ?? []),
        food: payload.food,
        lifts: payload.lifts,
        extraSlots: extra,
        closedSlotIds: [...new Set([...get().closedSlotIds, ...(payload.closedSlotIds ?? [])])],
        notices: payload.notices,
        dismissedSignalIds: payload.dismissedSignalIds,
        notifyPrefs: payload.notifyPrefs,
        waitlist: payload.waitlist,
        workoutLogs: payload.workoutLogs,
        checks: payload.checks,
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra),
        tab: cloud.role === "trainer" ? "clients" : get().tab === "clients" || get().tab === "signals" ? "slots" : get().tab,
      });
      persist(snap(get()), false);
      if (cloud.created) get().showToast("Вас приняли в зал.");
    });
    const initData = getTelegramInitData();
    if (initData) void requestJoin({ data: { initData } }).catch(() => undefined);
  },

  refreshCloud: () => {
    void syncFromCloud().then((cloud) => {
      if (!cloud) return;
      const payload = cloud.payload;
      slotHolds = payload.foreignHolds ?? {};
      const extra = mergeExtraSlots(get().extraSlots, payload.extraSlots ?? []);
      const joined = cloud.role === "trainer" ? payload.joinRequests ?? [] : mergeJoin(get().joinRequests, payload.joinRequests ?? []);
      const localFresh =
        cloud.role === "trainer"
          ? get().clients.filter((c) => c.id.startsWith("c_") && !(payload.clients ?? []).some((row) => row.id === c.id))
          : [];
      const seed = cloud.blocked
        ? get().clients
        : cloud.role === "trainer"
          ? [...(payload.clients ?? []), ...localFresh]
          : mergeClients(get().clients, payload.clients);
      const next = ensureApprovedClients({
        ...payload,
        clients: seed,
        joinRequests: joined,
        removedClientIds: cloud.role === "trainer" ? payload.removedClientIds ?? [] : get().removedClientIds ?? [],
      });
      set({
        role: cloud.role,
        inviteBlocked: Boolean(cloud.blocked) && !next.clients.length,
        removedClientIds: next.removedClientIds,
        clients: next.clients,
        coaches: payload.coaches ?? get().coaches,
        food: cloud.role === "trainer" ? payload.food : payload.food.length ? payload.food : get().food,
        lifts: cloud.role === "trainer" ? payload.lifts : payload.lifts.length ? payload.lifts : get().lifts,
        extraSlots: extra,
        closedSlotIds: payload.closedSlotIds.length ? [...new Set([...get().closedSlotIds, ...payload.closedSlotIds])] : get().closedSlotIds,
        notices: cloud.role === "trainer" ? payload.notices : payload.notices.length ? payload.notices : get().notices,
        workoutLogs: cloud.role === "trainer" ? payload.workoutLogs : payload.workoutLogs.length ? payload.workoutLogs : get().workoutLogs,
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra),
        bookings: cloud.role === "trainer" ? payload.bookings ?? [] : mergeByIdLocal(get().bookings, payload.bookings ?? []),
      });
      persist(snap(get()), false);
    });
  },

  sendJoinRequest: (message, extra) => {
    const user = getTelegramUser();
    if (!user) {
      get().showToast("Откройте из Telegram.");
      return;
    }
    const req: JoinRequest = {
      id: `jr_${user.id}`,
      telegramId: String(user.id),
      telegramUsername: user.username ?? null,
      firstName: user.first_name?.trim() || "Клиент",
      lastName: user.last_name?.trim() || "",
      message: message.trim().slice(0, 500),
      at: new Date().toISOString(),
      status: "pending",
      slotId: extra?.slotId,
      goal: extra?.goal,
      pack: extra?.pack,
    };
    const joinRequests = [req, ...get().joinRequests.filter((r) => r.telegramId !== req.telegramId)];
    set({ joinRequests });
    persist(snap(get()));
    get().showToast("Заявка отправлена.");
  },

  approveJoin: (id) => {
    const req = get().joinRequests.find((r) => r.id === id);
    if (!req) return;
    const me = String(getTelegramUser()?.id || "");
    if (req.coachId && me && req.coachId !== me) {
      get().showToast("Это заявка другого тренера.");
      return;
    }
    const uname = (req.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
    const existing =
      get().clients.find((c) => c.telegramId === req.telegramId) ??
      get().clients.find((c) => uname && (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === uname);
    const fresh = existing
      ? null
      : {
          ...emptyClient(),
          id: `tg_${req.telegramId}`,
          firstName: req.firstName,
          lastName: req.lastName,
          telegramId: req.telegramId,
          telegramUsername: req.telegramUsername,
          coachId: req.coachId || String(getTelegramUser()?.id || TRAINER_TG_ID),
        };
    const clientId = existing?.id ?? fresh!.id;
    const notice: Notice = {
      id: `nt_ok_${req.telegramId}`,
      audience: "client",
      clientId,
      kind: "join",
      title: "Вас приняли в зал",
      body: "Можно записываться. Тренер назначит программу и пакет.",
      at: new Date().toISOString(),
    };
    const nextClients = fresh
      ? [...get().clients, fresh]
      : get().clients.map((c) =>
          c.id === existing!.id ? { ...c, telegramId: req.telegramId, telegramUsername: req.telegramUsername ?? c.telegramUsername } : c,
        );
    const placed = applyOfferBooking({
      clients: nextClients,
      bookings: get().bookings,
      extraSlots: get().extraSlots,
      closedSlotIds: get().closedSlotIds,
      clientId,
      req,
    });
    set({
      clients: placed.clients,
      bookings: placed.bookings,
      activeClientId: get().role === "trainer" ? get().activeClientId : clientId,
      sheetClientId: get().role === "trainer" ? clientId : get().sheetClientId,
      joinRequests: get().joinRequests.map((r) => (r.id === id ? { ...r, status: "approved" as const } : r)),
      notices: [notice, ...get().notices].slice(0, 40),
      removedClientIds: dropTombstones(get().removedClientIds ?? [], [
        req.telegramId,
        `tg:${req.telegramId}`,
        ...(uname ? [`u:${uname}`] : []),
        clientId,
      ]),
    });
    persist(snap(get()));
    get().showToast(placed.booked ? `${req.firstName} в зале и на слоте.` : `${req.firstName} в зале. Слот занять не вышло.`);
    const initData = getTelegramInitData();
    if (initData) void decideJoinFn({ data: { initData, telegramId: req.telegramId, approve: true } }).catch(() => undefined);
  },

  rejectJoin: (id) => {
    const req = get().joinRequests.find((r) => r.id === id);
    set({
      joinRequests: get().joinRequests.map((r) => (r.id === id ? { ...r, status: "rejected" as const } : r)),
    });
    persist(snap(get()));
    const initData = getTelegramInitData();
    if (initData && req) void decideJoinFn({ data: { initData, telegramId: req.telegramId, approve: false } }).catch(() => undefined);
  },

  addCoach: async (username, firstName) => {
    const initData = getTelegramInitData();
    if (!initData) {
      get().showToast("Откройте из Telegram.");
      return;
    }
    const res = await addCoachFn({ data: { initData, username, firstName } }).catch(() => ({ ok: false as const }));
    if (!res.ok) {
      get().showToast("Не удалось добавить тренера.");
      return;
    }
    if (res.coaches) set({ coaches: res.coaches });
    get().showToast("Тренер добавлен. Пусть откроет бота.");
  },

  setTab: (tab) => set({ tab, selectedSlotId: null }),
  setRole: (role) => {
    if (telegramLocked()) return;
    let tab = get().tab;
    if (role === "trainer") {
      if (tab === "food" || tab === "program" || tab === "bookings" || tab === "hall") tab = "clients";
    } else if (tab === "clients" || tab === "signals") {
      tab = "program";
    }
    const selectedDate = role === "trainer" ? todayIso() : firstBookableDate();
    set({
      role,
      tab,
      sheetClientId: null,
      selectedDate,
      weekStart: isoDate(startOfWeek(parseISODate(selectedDate))),
    });
    persist(snap(get()));
  },
  setActiveClient: (id) => {
    if (!get().clients.some((c) => c.id === id)) return;
    set({ activeClientId: id });
    persist(snap(get()));
  },
  openClientSheet: (id) => set({ sheetClientId: id }),
  setClientFilter: (clientFilter) => set({ clientFilter }),
  shiftWeek: (dir) => {
    const current = new Date(`${get().weekStart}T00:00:00`);
    current.setDate(current.getDate() + dir * 7);
    const min = startOfWeek(new Date());
    if (current < min) return;
    const weekStart = isoDate(current);
    set({ weekStart, selectedDate: weekStart, selectedSlotId: null });
  },
  selectDay: (iso) => set({ selectedDate: iso, selectedSlotId: null }),

  bookSlot: (slotId, forClientId) => {
    if (slotBusy) return false;
    slotBusy = true;
    try {
    const { slots, bookings, activeClientId, role, clients, closedSlotIds, notices, waitlist } = get();
    const slot = slots.find((s) => s.id === slotId);
    const targetId = forClientId ?? activeClientId;
    const client = clients.find((c) => c.id === targetId) ?? clients[0];
    if (!slot || !client) return false;
    if (closedSlotIds.includes(slot.id)) {
      get().showToast("Слот закрыт для записи.");
      return false;
    }
    if (isSlotPast(slot.date, slot.time)) {
      get().showToast("Этот слот уже прошёл.");
      return false;
    }
    if (isFrozen(client)) {
      get().showToast(`Заморозка до ${formatDayMonth(client.frozenUntil!)}. Запись недоступна.`);
      return false;
    }
    if (bookings.some((b) => b.slotId === slot.id && b.clientId === client.id)) {
      get().showToast("Уже есть запись на этот слот.");
      return false;
    }
    if (slotTaken(slot, bookings) >= slot.capacity) {
      get().showToast("Слот занят. Можно встать в лист ожидания.");
      return false;
    }
    if (role !== "trainer" && (client.sessionsLeft ?? 0) <= 0) {
      get().showToast("На балансе нет занятий. Напишите тренеру.");
      return false;
    }
    if (role === "trainer" && (client.sessionsLeft ?? 0) <= 0) {
      get().showToast(`У ${client.firstName} нет занятий на балансе.`);
      return false;
    }
    const booking: Booking = {
      id: `bk_${slot.id}_${client.id}_${Date.now()}`,
      slotId: slot.id,
      clientId: client.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      held: true,
    };
    const hold = makeTxn(client.id, "hold", -1, `Запись ${formatLongDate(slot.date)} ${slot.time}`, booking.id);
    const left = Math.max(0, (client.sessionsLeft ?? 0) - 1);
    let nextNotices = pushNotice(notices, {
      id: `nt_book_${booking.id}`,
      audience: "trainer",
      clientId: client.id,
      kind: "book",
      title: `Новая запись: ${shortName(client)}`,
      body: `${formatLongDate(slot.date)} · ${slot.time} · осталось ${left} ${sessionsRu(left)}`,
      at: hoursAgoIso(0),
    });
    if (role === "trainer") {
      nextNotices = pushNotice(nextNotices, {
        id: `nt_book_cli_${booking.id}`,
        audience: "client",
        clientId: client.id,
        kind: "book",
        title: "Тренер записал вас",
        body: `${formatLongDate(slot.date)} · ${slot.time}`,
        at: hoursAgoIso(0),
      });
    }
    set({
      bookings: [...bookings, booking],
      selectedSlotId: slot.id,
      notices: nextNotices,
      clients: withTxn(clients, hold),
      waitlist: waitlist.filter((w) => !(w.slotId === slot.id && w.clientId === client.id)),
    });
    persist(snap(get()));
    hapticNotify("success");
    const dow = DOW[(parseISODate(slot.date).getDay() + 6) % 7].toLowerCase();
    if (role === "trainer") {
      pingClient(
        client.telegramId,
        `Тренер записал вас: ${formatLongDate(slot.date)} · ${slot.time}\nОткройте зал: https://t.me/${BOT_USERNAME}`,
      );
    }
    get().showToast(
      role === "trainer"
        ? `Запись: ${client.firstName} · ${dow} ${slot.time}`
        : `Готово. Встретимся ${dow} в ${slot.time}.`,
    );
    return true;
    } finally {
      slotBusy = false;
    }
  },

  joinWaitlist: (slotId) => {
    const { waitlist, activeClientId, slots, bookings, clients } = get();
    const slot = slots.find((s) => s.id === slotId);
    const client = clients.find((c) => c.id === activeClientId);
    if (!slot || !client) return;
    if (isFrozen(client)) {
      get().showToast("Пока заморозка — лист недоступен.");
      return;
    }
    if ((client.sessionsLeft ?? 0) <= 0) {
      get().showToast("Нужно хотя бы одно занятие на балансе.");
      return;
    }
    if (bookings.some((b) => b.slotId === slotId && b.clientId === client.id)) return;
    if (waitlist.some((w) => w.slotId === slotId && w.clientId === client.id)) {
      get().showToast("Вы уже в листе ожидания.");
      return;
    }
    const entry: WaitlistEntry = {
      id: `wl_${slotId}_${client.id}`,
      slotId,
      clientId: client.id,
      at: new Date().toISOString(),
    };
    set({ waitlist: [...waitlist, entry] });
    persist(snap(get()));
    get().showToast(`В листе на ${slot.time}. Если место освободится — запишем автоматически.`);
  },

  leaveWaitlist: (slotId) => {
    const id = get().activeClientId;
    set({ waitlist: get().waitlist.filter((w) => !(w.slotId === slotId && w.clientId === id)) });
    persist(snap(get()));
    get().showToast("Сняли с листа ожидания.");
  },

  checkIn: (bookingId) => {
    const { bookings, clients, notices } = get();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.checkedIn) return;
    const who = clients.find((c) => c.id === booking.clientId);
    const nextNotices = who
      ? pushNotice(notices, {
          id: `nt_in_${bookingId}`,
          audience: "trainer",
          clientId: who.id,
          kind: "checkin",
          title: `${shortName(who)} на месте`,
          body: `${booking.time} · чек-ин`,
          at: new Date().toISOString(),
        })
      : notices;
    set({
      bookings: bookings.map((b) => (b.id === bookingId ? { ...b, checkedIn: true, noShow: false } : b)),
      notices: nextNotices,
    });
    persist(snap(get()));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(16);
    get().showToast("Отметили: вы в зале.");
  },

  markNoShow: (bookingId) => {
    const { bookings, clients, notices } = get();
    const booking = bookings.find((b) => b.id === bookingId);
    if (!booking || booking.checkedIn || booking.noShow) return;
    const who = clients.find((c) => c.id === booking.clientId);
    const nextNotices = who
      ? pushNotice(notices, {
          id: `nt_ns_${bookingId}`,
          audience: "trainer",
          clientId: who.id,
          kind: "noshow",
          title: `${shortName(who)} — неявка`,
          body: `${formatLongDate(booking.date)} · ${booking.time} · занятие уже списано`,
          at: new Date().toISOString(),
        })
      : notices;
    set({
      bookings: bookings.map((b) => (b.id === bookingId ? { ...b, noShow: true } : b)),
      notices: nextNotices,
    });
    persist(snap(get()));
    get().showToast("Неявка. Занятие остаётся списанным.");
  },

  creditSessions: (clientId, amount) => {
    if (!amount) return;
    const { clients, notices } = get();
    const who = clients.find((c) => c.id === clientId);
    if (!who) return;
    const txn = makeTxn(
      clientId,
      amount > 0 ? "credit" : "adjust",
      amount,
      amount > 0 ? `Зачисление ${amount} ${sessionsRu(amount)}` : `Корректировка ${amount}`,
    );
    let next = withTxn(clients, txn);
    if (amount > 0) {
      const until = isoDate(addDays(new Date(), PACK_VALID_DAYS));
      next = next.map((c) => (c.id === clientId ? { ...c, packExpiresAt: until } : c));
    }
    const left = next.find((c) => c.id === clientId)?.sessionsLeft ?? 0;
    const nextNotices = pushNotice(notices, {
      id: `nt_wal_${txn.id}`,
      audience: "client",
      clientId,
      kind: "wallet",
      title: amount > 0 ? "Тренер пополнил баланс" : "Баланс занятий изменён",
      body: `${amount > 0 ? "+" : ""}${amount} · сейчас ${left} ${sessionsRu(left)}`,
      at: new Date().toISOString(),
    });
    set({ clients: next, notices: nextNotices });
    persist(snap(get()));
    hapticNotify("success");
    get().showToast(amount > 0 ? `Зачислено ${amount} ${sessionsRu(amount)}.` : `Списано ${Math.abs(amount)} ${sessionsRu(Math.abs(amount))}.`);
  },

  freezeClient: (clientId, days) => {
    if (days <= 0) return;
    const { clients, notices, waitlist } = get();
    const who = clients.find((c) => c.id === clientId);
    if (!who) return;
    const until = isoDate(addDays(new Date(), days));
    const nextNotices = pushNotice(notices, {
      id: `nt_fr_${clientId}_${Date.now()}`,
      audience: "client",
      clientId,
      kind: "freeze",
      title: "Пакет заморожен",
      body: `До ${formatDayMonth(until)} запись закрыта. Текущие слоты на месте.`,
      at: new Date().toISOString(),
    });
    set({
      clients: clients.map((c) => (c.id === clientId ? { ...c, frozenUntil: until } : c)),
      notices: nextNotices,
      waitlist: waitlist.filter((w) => w.clientId !== clientId),
    });
    persist(snap(get()));
    get().showToast(`Заморозка ${who.firstName} до ${formatDayMonth(until)}.`);
  },

  unfreezeClient: (clientId) => {
    const { clients, notices } = get();
    const who = clients.find((c) => c.id === clientId);
    if (!who) return;
    const nextNotices = pushNotice(notices, {
      id: `nt_uf_${clientId}_${Date.now()}`,
      audience: "client",
      clientId,
      kind: "freeze",
      title: "Заморозка снята",
      body: "Можно снова записываться на слоты.",
      at: new Date().toISOString(),
    });
    set({
      clients: clients.map((c) => (c.id === clientId ? { ...c, frozenUntil: null } : c)),
      notices: nextNotices,
    });
    persist(snap(get()));
    get().showToast("Заморозка снята.");
  },

  cancelBooking: (id, by) => {
    const { bookings, clients, notices, role, notifyPrefs, waitlist, slots } = get();
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const who = clients.find((c) => c.id === booking.clientId);
    const actor: Role = by ?? role;
    const hours = hoursUntilSlot(booking.date, booking.time);
    const late = notifyPrefs.flagLate && isLateCancel(booking.date, booking.time, notifyPrefs.windowHours);
    const burn = actor === "client" && late;
    const when = `${formatLongDate(booking.date)} · ${booking.time}`;
    const next = bookings.filter((b) => b.id !== id);
    let nextNotices = notices;
    let nextClients = clients;
    hapticNotify("warning");

    if (who && booking.held !== false) {
      if (burn) {
        const txn = makeTxn(who.id, "burn", 0, `Списание: отмена меньше чем за ${notifyPrefs.windowHours} ч`, booking.id);
        nextClients = nextClients.map((c) =>
          c.id === who.id
            ? { ...c, lateCancels: (c.lateCancels ?? 0) + 1, ledger: [txn, ...(c.ledger ?? [])].slice(0, 40) }
            : c,
        );
      } else {
        const txn = makeTxn(
          who.id,
          "refund",
          1,
          actor === "trainer" ? "Возврат: отмена тренером" : "Возврат: отмена заранее",
          booking.id,
        );
        nextClients = withTxn(nextClients, txn);
      }
    }

    if (actor === "trainer" && who && notifyPrefs.notifyClient) {
      nextNotices = pushNotice(nextNotices, {
        id: `nt_cancel_${id}_${Date.now()}`,
        audience: "client",
        clientId: who.id,
        kind: "cancel",
        late,
        slotId: booking.slotId,
        title: "Тренер отменил запись",
        body: `${when}. Занятие вернулось на баланс. Выберите другое время.`,
        at: new Date().toISOString(),
      });
    }
    if (actor === "client" && who && notifyPrefs.notifyTrainer) {
      nextNotices = pushNotice(nextNotices, {
        id: `nt_cancel_cli_${id}_${Date.now()}`,
        audience: "trainer",
        clientId: who.id,
        kind: "cancel",
        late: burn,
        slotId: booking.slotId,
        title: burn ? `${shortName(who)} — списание занятия` : `${shortName(who)} — отмена записи`,
        body: burn
          ? `${when} · меньше ${notifyPrefs.windowHours} ч · занятие сгорело`
          : `${when} · до слота ${hoursUntilLabel(hours)} · занятие вернулось`,
        at: new Date().toISOString(),
      });
    }

    let nextWait = waitlist;
    const slot = slots.find((s) => s.id === booking.slotId);
    if (slot && slotTaken(slot, next) < slot.capacity) {
      const queue = waitlist.filter((w) => w.slotId === booking.slotId).sort((a, b) => a.at.localeCompare(b.at));
      const pick = queue.find((w) => {
        const c = nextClients.find((x) => x.id === w.clientId);
        return c && (c.sessionsLeft ?? 0) > 0 && !next.some((b) => b.slotId === slot.id && b.clientId === c.id);
      });
      if (pick) {
        const guest = nextClients.find((c) => c.id === pick.clientId);
        if (guest) {
          const auto: Booking = {
            id: `bk_auto_${slot.id}_${guest.id}_${Date.now()}`,
            slotId: slot.id,
            clientId: guest.id,
            date: slot.date,
            time: slot.time,
            duration: slot.duration,
            held: true,
          };
          const hold = makeTxn(guest.id, "hold", -1, `Автозапись из листа · ${slot.time}`, auto.id);
          nextClients = withTxn(nextClients, hold);
          next.push(auto);
          nextWait = waitlist.filter((w) => w.id !== pick.id);
          nextNotices = pushNotice(nextNotices, {
            id: `nt_wl_${auto.id}`,
            audience: "client",
            clientId: guest.id,
            kind: "waitlist",
            slotId: slot.id,
            title: "Место освободилось — вы записаны",
            body: `${formatLongDate(slot.date)} · ${slot.time}`,
            at: new Date().toISOString(),
          });
          nextNotices = pushNotice(nextNotices, {
            id: `nt_wl_tr_${auto.id}`,
            audience: "trainer",
            clientId: guest.id,
            kind: "waitlist",
            title: `${shortName(guest)} с листа ожидания`,
            body: `${slot.time} · автозапись`,
            at: new Date().toISOString(),
          });
        }
      }
    }

    set({ bookings: next, notices: nextNotices, clients: nextClients, waitlist: nextWait });
    persist(snap(get()));

    if (actor === "trainer") {
      get().showToast("Запись отменена. Клиенту вернули занятие и отправили уведомление.");
    } else if (burn) {
      get().showToast("Поздняя отмена: занятие списано. Тренер получил уведомление.");
    } else {
      get().showToast("Запись отменена. Занятие вернулось на баланс.");
    }
  },

  cancelSlotBookings: (slotId) => {
    const ids = get()
      .bookings.filter((b) => b.slotId === slotId && !isSlotPast(b.date, b.time))
      .map((b) => b.id);
    for (const id of ids) get().cancelBooking(id, "trainer");
    const closedSlotIds = get().closedSlotIds.includes(slotId) ? get().closedSlotIds : [...get().closedSlotIds, slotId];
    set({ closedSlotIds });
    persist(snap(get()));
    get().showToast(
      ids.length
        ? `Слот закрыт. ${ids.length} ${ids.length === 1 ? "клиент получил" : "клиентов получили"} уведомление.`
        : "Слот закрыт.",
    );
  },

  rescheduleBooking: (id, newSlotId) => {
    const { bookings, slots, closedSlotIds, clients, notices } = get();
    const booking = bookings.find((b) => b.id === id);
    const slot = slots.find((s) => s.id === newSlotId);
    if (!booking || !slot) return false;
    if (closedSlotIds.includes(slot.id) || isSlotPast(slot.date, slot.time)) {
      get().showToast("Этот слот недоступен.");
      return false;
    }
    if (slotTaken(slot, bookings.filter((b) => b.id !== id)) >= slot.capacity) {
      get().showToast("Слот занят.");
      return false;
    }
    const who = clients.find((c) => c.id === booking.clientId);
    const updated: Booking = {
      ...booking,
      slotId: slot.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
    };
    const nextNotices = who
      ? pushNotice(notices, {
          id: `nt_move_${id}_${slot.id}`,
          audience: "client",
          clientId: who.id,
          kind: "reschedule",
          title: "Тренер перенёс запись",
          body: `Было ${booking.time} · стало ${DOW[(parseISODate(slot.date).getDay() + 6) % 7]} ${slot.time}`,
          at: new Date().toISOString(),
        })
      : notices;
    set({
      bookings: bookings.map((b) => (b.id === id ? updated : b)),
      notices: nextNotices,
    });
    persist(snap(get()));
    get().showToast("Перенос сохранён. Клиенту ушло уведомление.");
    return true;
  },

  addFood: (mealId) => {
    const meal = MEALS.find((m) => m.id === mealId);
    if (!meal) return;
    const entry: FoodLog = {
      ...meal,
      logId: `f_${Date.now()}`,
      date: todayIso(),
      clientId: get().activeClientId,
    };
    const food = [...get().food, entry];
    const clients = get().clients.map((c) =>
      c.id === entry.clientId ? { ...c, lastReportAt: todayIso(), streak: c.streak + (c.lastReportAt === todayIso() ? 0 : 1) } : c,
    );
    set({ food, clients });
    persist(snap(get()));
  },

  addCustomFood: (meal) => {
    const entry: FoodLog = {
      id: `custom_${Date.now()}`,
      ...meal,
      logId: `f_${Date.now()}`,
      date: todayIso(),
      clientId: get().activeClientId,
    };
    const food = [...get().food, entry];
    const clients = get().clients.map((c) =>
      c.id === entry.clientId
        ? { ...c, lastReportAt: todayIso(), streak: c.streak + (c.lastReportAt === todayIso() ? 0 : 1) }
        : c,
    );
    set({ food, clients });
    persist(snap(get()));
    get().showToast(`Добавлено: ${meal.name}`);
  },

  removeFood: (logId) => {
    const food = get().food.filter((f) => f.logId !== logId);
    set({ food });
    persist(snap(get()));
  },

  addLift: (exercise, weight, reps, sets) => {
    const lifts = [
      ...get().lifts,
      {
        id: `lift_${Date.now()}`,
        date: todayIso(),
        exercise,
        weight,
        reps,
        sets,
        clientId: get().activeClientId,
      },
    ];
    set({ lifts });
    persist(snap(get()));
    get().showToast(`Записано: ${exercise} ${weight} кг`);
  },

  toggleCheck: (item) => {
    const id = get().activeClientId;
    const key = `${id}:${todayIso()}`;
    const current = get().checks[key] ?? [];
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    set({ checks: { ...get().checks, [key]: next } });
    persist(snap(get()));
  },

  completeWorkout: (totalItems, minutes, startedAt, extraVolume = 0) => {
    const { activeClientId, clients, bookings, checks, workoutLogs, lifts } = get();
    const client = clients.find((c) => c.id === activeClientId);
    if (!client) return;
    const today = todayIso();
    const key = `${client.id}:${today}`;
    const doneItems = checks[key] ?? [];
    if (!doneItems.length) {
      get().showToast("Отметьте хотя бы одно упражнение.");
      return;
    }
    const booking = bookings.find((b) => b.clientId === client.id && b.date === today);
    const mins = Math.max(1, Math.round(minutes ?? booking?.duration ?? 60));
    const volume =
      lifts
        .filter((l) => l.clientId === client.id && l.date === today)
        .reduce((sum, l) => sum + l.weight * l.reps * l.sets, 0) + Math.max(0, extraVolume);
    const total = Math.max(totalItems, doneItems.length);
    const kcal = workoutKcal(client.weight, mins, doneItems.length, total) + Math.round(volume * 0.04);
    const log: WorkoutLog = {
      id: `wo_${Date.now()}`,
      clientId: client.id,
      date: today,
      minutes: mins,
      kcal,
      done: doneItems.length,
      total,
      at: new Date().toISOString(),
      startedAt,
    };
    const nextLogs = [log, ...workoutLogs.filter((w) => !(w.clientId === client.id && w.date === today))].slice(0, 60);
    const nextClients = clients.map((c) =>
      c.id === client.id
        ? { ...c, lastReportAt: today, streak: c.streak + (c.lastReportAt === today ? 0 : 1) }
        : c,
    );
    const nextBookings = booking && !booking.checkedIn
      ? get().bookings.map((b) => (b.id === booking.id ? { ...b, checkedIn: true, noShow: false } : b))
      : get().bookings;
    set({ workoutLogs: nextLogs, clients: nextClients, bookings: nextBookings });
    persist(snap(get()));
    hapticNotify("success");
    get().showToast(`Тренировка закрыта · ${mins} мин · ${kcal} ккал`);
  },

  setWeight: (kg) => {
    const id = get().activeClientId;
    const today = todayIso();
    const clients = get().clients.map((c) => {
      if (c.id !== id) return c;
      const history = [...c.weightHistory.filter((p) => p.date !== today), { date: today, kg }];
      return { ...c, weight: kg, weightHistory: history };
    });
    set({ clients });
    persist(snap(get()));
  },

  addSlot: (date, time, capacity) => {
    const id = `${date}_${time}`;
    const slot: Slot = { id, date, time, duration: 60, capacity, seeded: 0 };
    const extraSlots = [...get().extraSlots.filter((s) => s.id !== id), slot];
    const closedSlotIds = get().closedSlotIds.filter((x) => x !== id);
    set({
      extraSlots,
      closedSlotIds,
      slots: mergeSlots(extraSlots),
    });
    persist(snap(get()));
    get().showToast(`Слот ${time} открыт.`);
  },

  closeSlot: (id) => {
    const booked = get().bookings.filter((b) => b.slotId === id && !isSlotPast(b.date, b.time));
    const closedSlotIds = get().closedSlotIds.includes(id) ? get().closedSlotIds : [...get().closedSlotIds, id];
    set({ closedSlotIds });
    persist(snap(get()));
    get().showToast(
      booked.length ? "Слот закрыт для новых записей. Текущие остаются." : "Слот закрыт и скрыт у клиентов.",
    );
  },

  openSlot: (id) => {
    const closedSlotIds = get().closedSlotIds.filter((x) => x !== id);
    set({ closedSlotIds });
    persist(snap(get()));
    get().showToast("Слот снова открыт.");
  },

  deleteSlot: (id) => {
    get().cancelSlotBookings(id);
    const extraSlots = get().extraSlots.filter((s) => s.id !== id);
    const closedSlotIds = get().closedSlotIds.includes(id) ? get().closedSlotIds : [...get().closedSlotIds, id];
    set({ extraSlots, closedSlotIds, slots: mergeSlots(extraSlots) });
    persist(snap(get()));
    get().showToast("Слот удалён.");
  },

  addClient: (draft) => {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    if (!firstName) {
      get().showToast("Напишите имя.");
      return "";
    }
    const handle = draft.telegramUsername?.replace(/^@/, "").trim().toLowerCase() || "";
    if (handle && get().clients.some((c) => (c.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === handle)) {
      get().showToast("Этот @username уже в зале.");
      return "";
    }
    const phoneDigits = (draft.phone ?? "").replace(/\D/g, "");
    const phone =
      phoneDigits.length === 11 && phoneDigits.startsWith("8")
        ? `7${phoneDigits.slice(1)}`
        : phoneDigits.length === 10
          ? `7${phoneDigits}`
          : phoneDigits || "";
    if (phone.length >= 10 && get().clients.some((c) => (c.phone ?? "").replace(/\D/g, "").endsWith(phone.slice(-10)))) {
      get().showToast("Этот номер уже в зале.");
      return "";
    }
    const client = {
      ...emptyClient(),
      firstName,
      lastName,
      telegramUsername: draft.telegramUsername?.replace(/^@/, "").trim() || null,
      phone: phone || null,
      coachId: String(getTelegramUser()?.id || TRAINER_TG_ID),
    };
    const clients = [...get().clients, client];
    set({
      clients,
      activeClientId: client.id,
      sheetClientId: client.id,
      removedClientIds: dropTombstones(get().removedClientIds ?? [], tombstonesFor(client)),
    });
    persist(snap(get()));
    get().showToast("Клиент добавлен. Назначьте пакет и программу.");
    pingClient(
      client.telegramId,
      `Вас добавили в зал Ruksha Discipline.\nОткройте бота: https://t.me/${BOT_USERNAME}`,
    );
    return client.id;
  },

  claimByPhone: async (raw) => {
    const pass = importClientPass(raw);
    if (pass) {
      const client = {
        ...emptyClient(),
        ...pass,
        id: `tg_pass_${digitsPhone(pass.phone) || pass.telegramUsername || Date.now()}`,
      };
      const others = get().clients.filter((c) => c.id !== client.id);
      set({
        role: "client",
        inviteBlocked: false,
        clients: [...others, client],
        activeClientId: client.id,
      });
      persist(snap(get()));
      get().showToast("Вы в зале.");
      return true;
    }
    const phone = raw.replace(/\D/g, "");
    if (phone.length < 10) {
      get().showToast("Введите номер телефона.");
      return false;
    }
    const local = get().clients.find((c) => (c.phone ?? "").replace(/\D/g, "").endsWith(phone.slice(-10)));
    if (local) {
      set({ inviteBlocked: false, activeClientId: local.id, role: "client" });
      persist(snap(get()));
      get().showToast("Вы в зале.");
      return true;
    }
    const cloud = await syncFromCloud(raw);
    if (cloud && !cloud.blocked && cloud.payload.clients[0]) {
      const extra = cloud.payload.extraSlots ?? get().extraSlots;
      set({
        role: "client",
        inviteBlocked: false,
        clients: mergeClients(get().clients, cloud.payload.clients),
        activeClientId: cloud.payload.clients[0].id,
        trainerUsername: cloud.payload.trainerUsername ?? get().trainerUsername,
        extraSlots: extra,
        slots: mergeSlots(extra),
        food: cloud.payload.food.length ? cloud.payload.food : get().food,
      });
      persist(snap(get()));
      get().showToast("Вы в зале.");
      return true;
    }
    get().showToast("Этот номер тренер ещё не занёс. Напишите ему в личку.");
    return false;
  },

  removeClient: (id) => {
    const who = get().clients.find((c) => c.id === id);
    const clients = get().clients.filter((c) => c.id !== id);
    const activeClientId = get().activeClientId === id ? clients[0]?.id ?? "" : get().activeClientId;
    const bookings = get().bookings.filter((b) => b.clientId !== id);
    const food = get().food.filter((f) => f.clientId !== id);
    const lifts = get().lifts.filter((l) => l.clientId !== id);
    const notices = get().notices.filter((n) => n.clientId !== id);
    const waitlist = get().waitlist.filter((w) => w.clientId !== id);
    const removedClientIds = [...new Set([...(get().removedClientIds ?? []), ...(who ? tombstonesFor(who) : [id])])];
    const joinRequests = get().joinRequests.map((r) => {
      if (!who) return r;
      const sameId = who.telegramId && r.telegramId === who.telegramId;
      const u = (who.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase();
      const sameUser = u && (r.telegramUsername ?? "").replace(/^@/, "").trim().toLowerCase() === u;
      return sameId || sameUser ? { ...r, status: "rejected" as const } : r;
    });
    set({
      clients,
      activeClientId,
      bookings,
      food,
      lifts,
      notices,
      waitlist,
      removedClientIds,
      joinRequests,
      sheetClientId: get().sheetClientId === id ? null : get().sheetClientId,
    });
    persist(snap(get()));
    get().showToast("Клиент удалён.");
  },

  updateClient: (id, patch) => {
    const clients = get().clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
    set({ clients });
    persist(snap(get()));
  },

  dismissSignal: (id) => {
    const dismissedSignalIds = get().dismissedSignalIds.includes(id)
      ? get().dismissedSignalIds
      : [...get().dismissedSignalIds, id];
    const notices = get().notices.filter((n) => n.id !== id);
    set({ dismissedSignalIds, notices });
    persist(snap(get()));
  },

  setNotifyPrefs: (patch) => {
    const notifyPrefs = { ...get().notifyPrefs, ...patch };
    set({ notifyPrefs });
    persist(snap(get()));
  },

  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2200);
  },
  clearToast: () => set({ toast: null }),
  openNote: () => set({ noteOpen: true }),
  closeNote: () => set({ noteOpen: false }),
  openGuestPreview: () => set({ guestPreview: true }),
  closeGuestPreview: () => set({ guestPreview: false }),
}));
