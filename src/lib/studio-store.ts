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
  ARRIVE_WATER,
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
  type DayCheck,
  type JoinRequest,
  type LiftLog,
  type Meal,
  type Notice,
  type NotifyPrefs,
  type SessionTxn,
  type Slot,
  type Visit,
  type WaitlistEntry,
  type WorkoutLog,
  workoutKcal,
  coachKey,
  TRAINER_TG_ID,
  type Coach,
  coachPhase,
  COACH_TRIAL_CAP,
} from "@/data/studio";

import { hapticNotify } from "@/lib/haptics";
import { withArrival } from "@/lib/studio-visits";
import { applyTelegramIdentity, scheduleCloudPush, syncFromCloud, telegramLocked } from "@/lib/studio-identity";
import { addCoachFn, decideJoinFn, dropTombstones, ensureApprovedClients, isRemovedClient, mergeClients, payCoachFn, removeCoachFn, requestJoin, sendBotLinkFn, tombstonesFor } from "@/lib/studio-sync";
import { stripDemoData } from "@/lib/studio-clean";
import { getTelegramInitData, getTelegramUser } from "@/lib/telegram";

export type TabId = "today" | "schedule" | "program" | "more" | "slots" | "bookings" | "food" | "form" | "hall" | "clients" | "signals";
export type Role = "client" | "trainer";
export type ClientFilter = "all" | "attention" | "today";

function coachGate(coaches: Coach[]) {
  const me = String(getTelegramUser()?.id || "");
  if (!me || me === String(TRAINER_TG_ID)) return "open" as const;
  const row = coaches.find((c) => c.telegramId === me);
  if (!row) return "open" as const;
  const phase = coachPhase(row);
  if (phase === "paused" || phase === "expired") return "pause" as const;
  if (phase === "trial") return "cap" as const;
  return "open" as const;
}

type PersistShape = {
  bookings: Booking[];
  food: FoodLog[];
  dayChecks: DayCheck[];
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
  visits: Visit[];
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
  dayChecks: DayCheck[];
  lifts: LiftLog[];
  clients: Client[];
  activeClientId: string;
  notices: Notice[];
  dismissedSignalIds: string[];
  notifyPrefs: NotifyPrefs;
  waitlist: WaitlistEntry[];
  workoutLogs: WorkoutLog[];
  checks: Record<string, string[]>;
  visits: Visit[];
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
  removeCoach: (coach: { username?: string | null; code?: string; telegramId?: string | null }) => Promise<void>;
  payCoach: (coach: { username?: string | null; code?: string; telegramId?: string | null }) => Promise<void>;
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
  arrive: () => void;
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
  saveDayCheck: (patch: Partial<Pick<DayCheck, "steps" | "sleepHours" | "waterMl" | "moveMin" | "moveKind">>) => void;
  importFatSecret: (meal: { calories: number; protein: number; fat: number; carbs: number }) => void;
  ensureHealthToken: () => string;
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
    dayChecks: s.dayChecks,
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
    visits: s.visits,
    trainerUsername: s.trainerUsername,
    joinRequests: s.joinRequests,
    removedClientIds: s.removedClientIds,
    coaches: s.coaches,
  };
}

function ownBookings(local: Booking[], incoming: Booking[], clientIds: string[]) {
  const ids = new Set(clientIds);
  return mergeByIdLocal(
    local.filter((booking) => ids.has(booking.clientId)),
    incoming.filter((booking) => ids.has(booking.clientId)),
  );
}

function mergeExtraSlots(a: Slot[], b: Slot[]) {
  const map = new Map(a.map((s) => [s.id, s]));
  for (const s of b) map.set(s.id, s);
  return [...map.values()];
}

let slotHolds: Record<string, number> = {};

function slotViewer(clients: Client[], role: Role) {
  const me = getTelegramUser()?.id || "";
  if (role === "trainer") return me || String(TRAINER_TG_ID);
  const mine = clients.find((client) => me && client.telegramId === me) ?? clients[0];
  return mine?.coachId || String(TRAINER_TG_ID);
}

function mergeSlots(extra: Slot[], viewerId?: string) {
  const viewer = coachKey(viewerId || String(TRAINER_TG_ID));
  const owner = String(TRAINER_TG_ID);
  const mine = extra.filter((slot) => coachKey(slot.ownerId) === viewer);
  const rows =
    viewer === owner
      ? (() => {
          const base = generateWindow(startOfWeek(new Date()), 42);
          const map = new Map(base.map((slot) => [slot.id, { ...slot, ownerId: owner }]));
          for (const slot of mine) map.set(slot.id, { ...slot, ownerId: slot.ownerId || owner });
          return [...map.values()];
        })()
      : mine;
  return rows
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
  tab: "today",
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
  dayChecks: [],
  lifts: [],
  clients: [],
  activeClientId: "",
  notices: [],
  dismissedSignalIds: [],
  notifyPrefs: DEFAULT_NOTIFY,
  waitlist: [],
  workoutLogs: [],
  checks: {},
  visits: [],
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
    let dayChecks: DayCheck[] = [];
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
    let visits: Visit[] = [];
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
        dayChecks = parsed.dayChecks ?? [];
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
        visits = parsed.visits ?? [];
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
      slots: mergeSlots(extraSlots, slotViewer(clients, role)),
      extraSlots,
      closedSlotIds,
      weekStart: isoDate(startOfWeek(parseISODate(selectedDate))),
      selectedDate,
      bookings,
      food,
      dayChecks,
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
      visits,
      trainerUsername,
      joinRequests,
      removedClientIds,
      coaches,
      inviteBlocked,
      tab: "today",
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
        bookings: cloud.role === "trainer" ? payload.bookings ?? [] : ownBookings(get().bookings, payload.bookings ?? [], next.clients.map((client) => client.id)),
        food: payload.food,
        dayChecks: payload.dayChecks ?? [],
        lifts: payload.lifts,
        extraSlots: extra,
        closedSlotIds: [...new Set([...get().closedSlotIds, ...(payload.closedSlotIds ?? [])])],
        notices: payload.notices,
        dismissedSignalIds: payload.dismissedSignalIds ?? get().dismissedSignalIds,
        notifyPrefs: payload.notifyPrefs ?? get().notifyPrefs,
        waitlist: payload.waitlist,
        workoutLogs: payload.workoutLogs,
        checks: payload.checks,
        visits: payload.visits ?? [],
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        joinRequests: next.joinRequests,
        slots: mergeSlots(extra, slotViewer(next.clients, cloud.role)),
        tab: cloud.role === "trainer" ? "today" : get().tab === "clients" || get().tab === "signals" ? "today" : get().tab,
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
      set({
        extraSlots: extra,
        closedSlotIds: [...new Set([...get().closedSlotIds, ...(payload.closedSlotIds ?? [])])],
        slots: mergeSlots(extra, slotViewer(get().clients, get().role)),
        bookings:
          get().role === "trainer"
            ? payload.bookings ?? get().bookings
            : ownBookings(get().bookings, payload.bookings ?? [], get().clients.map((c) => c.id)),
        notices: payload.notices ?? get().notices,
        joinRequests: payload.joinRequests ?? get().joinRequests,
        coaches: payload.coaches ?? get().coaches,
      });
    });
  },

  sendJoinRequest: (message, extra) => {
    const initData = getTelegramInitData();
    if (!initData) {
      get().showToast("Откройте из Telegram.");
      return;
    }
    void requestJoin({ data: { initData, message, ...extra } }).then((res) => {
      if (res?.ok) get().showToast("Заявка отправлена.");
      else get().showToast("Не удалось отправить заявку.");
    });
  },

  approveJoin: (id) => {
    const initData = getTelegramInitData();
    if (!initData) return;
    void decideJoinFn({ data: { initData, id, decision: "approve" } }).then((res) => {
      if (res?.ok) {
        get().showToast("Клиент принят.");
        get().refreshCloud();
      }
    });
  },

  rejectJoin: (id) => {
    const initData = getTelegramInitData();
    if (!initData) return;
    void decideJoinFn({ data: { initData, id, decision: "reject" } }).then((res) => {
      if (res?.ok) get().refreshCloud();
    });
  },

  addCoach: async (username, firstName) => {
    const initData = getTelegramInitData();
    if (!initData) return;
    const res = await addCoachFn({ data: { initData, username, firstName } }).catch(() => null);
    if (res?.ok && res.coaches) {
      set({ coaches: res.coaches });
      persist(snap(get()));
      get().showToast("Тренер добавлен.");
    } else get().showToast("Не удалось добавить.");
  },

  removeCoach: async (coach) => {
    const initData = getTelegramInitData();
    if (!initData) return;
    const res = await removeCoachFn({
      data: { initData, username: coach.username ?? "", code: coach.code, telegramId: coach.telegramId ?? "" },
    }).catch(() => null);
    if (res?.ok && res.coaches) {
      set({ coaches: res.coaches });
      persist(snap(get()));
    }
  },

  payCoach: async (coach) => {
    const initData = getTelegramInitData();
    if (!initData) return;
    const res = await payCoachFn({
      data: { initData, username: coach.username ?? "", code: coach.code, telegramId: coach.telegramId ?? "" },
    }).catch(() => ({ ok: false as const }));
    if (!res.ok) {
      get().showToast("Не удалось отметить оплату.");
      return;
    }
    if (res.coaches) set({ coaches: res.coaches });
    persist(snap({ ...get(), coaches: res.coaches ?? get().coaches }));
    get().showToast("Оплата принята. Доступ ещё на 30 дней.");
  },

  setTab: (tab) => set({ tab, selectedSlotId: null }),
  setRole: (role) => {
    if (telegramLocked()) return;
    let tab = get().tab;
    if (role === "trainer") {
      if (tab === "food" || tab === "program" || tab === "hall" || tab === "form" || tab === "more") tab = "today";
    } else if (tab === "clients" || tab === "signals") {
      tab = "today";
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
    set({ weekStart: isoDate(startOfWeek(current)) });
  },
  selectDay: (iso) => set({ selectedDate: iso, selectedSlotId: null }),

  bookSlot: (slotId, forClientId) => {
    if (slotBusy) return false;
    const state = get();
    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) return false;
    if (state.closedSlotIds.includes(slotId)) {
      get().showToast("Слот закрыт.");
      return false;
    }
    const clientId = forClientId || state.activeClientId;
    const client = state.clients.find((c) => c.id === clientId);
    if (!client) {
      get().showToast("Клиент не выбран.");
      return false;
    }
    if (isFrozen(client)) {
      get().showToast("Заморозка активна.");
      return false;
    }
    if ((client.sessionsLeft ?? 0) <= 0) {
      get().showToast("Нет занятий на балансе.");
      return false;
    }
    if (state.bookings.some((b) => b.slotId === slotId && b.clientId === clientId)) {
      get().showToast("Уже записаны.");
      return false;
    }
    const taken = occupancy(slot, state.bookings);
    if (taken >= slot.capacity) {
      get().showToast("Мест нет.");
      return false;
    }
    slotBusy = true;
    try {
      const booking: Booking = {
        id: `bk_${slotId}_${clientId}_${Date.now()}`,
        slotId,
        clientId,
        date: slot.date,
        time: slot.time,
        duration: slot.duration,
        checkedIn: false,
        noShow: false,
        createdAt: new Date().toISOString(),
      };
      const txn = makeTxn(clientId, "book", -1, `Запись ${slot.date} ${slot.time}`, booking.id);
      const clients = withTxn(state.clients, txn);
      const bookings = [...state.bookings, booking];
      const notices = pushNotice(state.notices, {
        id: `n_book_${booking.id}`,
        kind: "book",
        audience: "client",
        clientId,
        title: "Запись подтверждена",
        body: `${slot.date} · ${slot.time}`,
        at: new Date().toISOString(),
      });
      set({ bookings, clients, notices });
      persist(snap(get()));
      hapticNotify("success");
      get().showToast("Записаны.");
      void import("@/lib/notify/hook-booking").then(({ enqueueBookingConfirmed }) => {
        enqueueBookingConfirmed({
          telegramId: client.telegramId,
          bookingId: booking.id,
          clientId,
          date: slot.date,
          time: slot.time,
        });
      });
      return true;
    } finally {
      slotBusy = false;
    }
  },

  joinWaitlist: (slotId) => {
    const { waitlist, activeClientId, slots, bookings, clients } = get();
    const client = clients.find((c) => c.id === activeClientId);
    if (!client) return;
    if (waitlist.some((w) => w.slotId === slotId && w.clientId === activeClientId)) return;
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;
    const entry = {
      id: `wl_${slotId}_${activeClientId}`,
      slotId,
      clientId: activeClientId,
      at: new Date().toISOString(),
    };
    set({ waitlist: [...waitlist, entry] });
    persist(snap(get()));
    get().showToast("В листе ожидания.");
  },

  leaveWaitlist: (slotId) => {
    set({ waitlist: get().waitlist.filter((w) => !(w.slotId === slotId && w.clientId === get().activeClientId)) });
    persist(snap(get()));
  },

  checkIn: (bookingId) => {
    const bookings = get().bookings.map((b) =>
      b.id === bookingId ? { ...b, checkedIn: true, noShow: false } : b,
    );
    set({ bookings });
    persist(snap(get()));
    get().showToast("Отметили явку.");
  },

  arrive: () => {
    const client = activeClient(get());
    if (!client) return;
    const visits = withArrival(get().visits, client.id);
    set({ visits });
    persist(snap(get()));
    get().showToast("Вы в зале.");
  },

  markNoShow: (bookingId) => {
    const bookings = get().bookings.map((b) =>
      b.id === bookingId ? { ...b, noShow: true, checkedIn: false } : b,
    );
    set({ bookings });
    persist(snap(get()));
    get().showToast("Неявка.");
  },

  creditSessions: (clientId, amount) => {
    const txn = makeTxn(clientId, "credit", amount, `Пакет +${amount}`);
    const clients = withTxn(get().clients, txn).map((c) => {
      if (c.id !== clientId) return c;
      return {
        ...c,
        packExpiresAt: addDays(todayIso(), PACK_VALID_DAYS),
      };
    });
    set({ clients });
    persist(snap(get()));
    get().showToast(`+${amount} занятий.`);
  },

  freezeClient: (clientId, days) => {
    const until = addDays(todayIso(), days);
    const clients = get().clients.map((c) =>
      c.id === clientId ? { ...c, frozenUntil: until } : c,
    );
    set({ clients });
    persist(snap(get()));
    get().showToast(`Заморозка до ${formatDayMonth(until)}.`);
  },

  unfreezeClient: (clientId) => {
    const clients = get().clients.map((c) =>
      c.id === clientId ? { ...c, frozenUntil: null } : c,
    );
    set({ clients });
    persist(snap(get()));
    get().showToast("Заморозка снята.");
  },

  cancelBooking: (id, by) => {
    const booking = get().bookings.find((b) => b.id === id);
    if (!booking) return;
    const late = isLateCancel(booking.date, booking.time, get().notifyPrefs.windowHours);
    let clients = get().clients;
    if (!(by === "client" && late)) {
      const txn = makeTxn(booking.clientId, "refund", 1, "Отмена записи", booking.id);
      clients = withTxn(clients, txn);
    } else {
      const txn = makeTxn(booking.clientId, "late_cancel", 0, "Поздняя отмена", booking.id);
      clients = clients.map((c) =>
        c.id === booking.clientId
          ? { ...c, lateCancels: (c.lateCancels ?? 0) + 1, ledger: [txn, ...(c.ledger ?? [])].slice(0, 40) }
          : c,
      );
    }
    const bookings = get().bookings.filter((b) => b.id !== id);
    set({ bookings, clients });
    persist(snap(get()));
    get().showToast("Запись отменена.");
  },

  cancelSlotBookings: (slotId) => {
    const affected = get().bookings.filter((b) => b.slotId === slotId);
    let clients = get().clients;
    for (const b of affected) {
      const txn = makeTxn(b.clientId, "refund", 1, "Слот отменён", b.id);
      clients = withTxn(clients, txn);
    }
    set({
      bookings: get().bookings.filter((b) => b.slotId !== slotId),
      clients,
    });
    persist(snap(get()));
  },

  rescheduleBooking: (id, newSlotId) => {
    const booking = get().bookings.find((b) => b.id === id);
    const slot = get().slots.find((s) => s.id === newSlotId);
    if (!booking || !slot) return false;
    if (occupancy(slot, get().bookings) >= slot.capacity) return false;
    const bookings = get().bookings.map((b) =>
      b.id === id
        ? { ...b, slotId: newSlotId, date: slot.date, time: slot.time, duration: slot.duration }
        : b,
    );
    set({ bookings });
    persist(snap(get()));
    get().showToast("Перенесено.");
    return true;
  },

  addFood: (mealId) => {
    const meal = MEALS.find((m) => m.id === mealId);
    if (!meal) return;
    const clientId = get().activeClientId;
    const log: FoodLog = {
      id: `f_${Date.now()}`,
      clientId,
      mealId,
      at: new Date().toISOString(),
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      name: meal.name,
    };
    set({ food: [log, ...get().food] });
    persist(snap(get()));
  },

  addCustomFood: (meal) => {
    const clientId = get().activeClientId;
    const log: FoodLog = {
      id: `f_${Date.now()}`,
      clientId,
      at: new Date().toISOString(),
      calories: meal.calories,
      protein: meal.protein,
      fat: meal.fat,
      carbs: meal.carbs,
      name: meal.name,
    };
    set({ food: [log, ...get().food] });
    persist(snap(get()));
  },

  removeFood: (logId) => {
    set({ food: get().food.filter((f) => f.id !== logId) });
    persist(snap(get()));
  },

  saveDayCheck: (patch) => {
    const clientId = get().activeClientId;
    const day = todayIso();
    const existing = get().dayChecks.find((d) => d.clientId === clientId && d.date === day);
    const row: DayCheck = {
      id: existing?.id ?? `dc_${clientId}_${day}`,
      clientId,
      date: day,
      steps: patch.steps ?? existing?.steps ?? 0,
      sleepHours: patch.sleepHours ?? existing?.sleepHours ?? 0,
      waterMl: patch.waterMl ?? existing?.waterMl ?? 0,
      moveMin: patch.moveMin ?? existing?.moveMin ?? 0,
      moveKind: patch.moveKind ?? existing?.moveKind ?? "",
    };
    const dayChecks = existing
      ? get().dayChecks.map((d) => (d.id === existing.id ? row : d))
      : [row, ...get().dayChecks];
    set({ dayChecks });
    persist(snap(get()));
  },

  importFatSecret: (meal) => {
    get().addCustomFood({ name: "FatSecret", ...meal });
  },

  ensureHealthToken: () => {
    try {
      const k = "ruksha_health_token";
      let t = localStorage.getItem(k);
      if (!t) {
        t = `ht_${Date.now()}`;
        localStorage.setItem(k, t);
      }
      return t;
    } catch {
      return "ht_local";
    }
  },

  addLift: (exercise, weight, reps, sets) => {
    const log: LiftLog = {
      id: `l_${Date.now()}`,
      clientId: get().activeClientId,
      exercise,
      weight,
      reps,
      sets,
      at: new Date().toISOString(),
    };
    set({ lifts: [log, ...get().lifts] });
    persist(snap(get()));
  },

  toggleCheck: (item) => {
    const clientId = get().activeClientId;
    const day = todayIso();
    const key = `${clientId}_${day}`;
    const cur = get().checks[key] ?? [];
    const next = cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item];
    set({ checks: { ...get().checks, [key]: next } });
    persist(snap(get()));
  },

  completeWorkout: (totalItems, minutes, startedAt, extraVolume) => {
    const clientId = get().activeClientId;
    const log: WorkoutLog = {
      id: `w_${Date.now()}`,
      clientId,
      at: new Date().toISOString(),
      totalItems,
      minutes: minutes ?? 60,
      startedAt,
      extraVolume,
      kcal: workoutKcal(minutes ?? 60),
    };
    set({ workoutLogs: [log, ...get().workoutLogs] });
    persist(snap(get()));
    get().showToast("Тренировка записана.");
  },

  setWeight: (kg) => {
    const clients = get().clients.map((c) => {
      if (c.id !== get().activeClientId) return c;
      const weightHistory = [{ at: todayIso(), kg }, ...(c.weightHistory ?? [])].slice(0, 40);
      return { ...c, weight: kg, weightHistory };
    });
    set({ clients });
    persist(snap(get()));
  },

  addSlot: (date, time, capacity) => {
    const id = `s_${date}_${time.replace(":", "")}_${capacity}`;
    if (get().extraSlots.some((s) => s.id === id) || get().slots.some((s) => s.id === id)) {
      get().showToast("Такой слот уже есть.");
      return;
    }
    const ownerId = String(getTelegramUser()?.id || TRAINER_TG_ID);
    const slot: Slot = {
      id,
      date,
      time,
      duration: 60,
      capacity,
      seeded: 0,
      ownerId,
    };
    const extraSlots = [...get().extraSlots, slot];
    set({ extraSlots, slots: mergeSlots(extraSlots, slotViewer(get().clients, get().role)) });
    persist(snap(get()));
    get().showToast("Слот добавлен.");
  },

  closeSlot: (id) => {
    set({ closedSlotIds: [...new Set([...get().closedSlotIds, id])] });
    persist(snap(get()));
  },

  openSlot: (id) => {
    set({ closedSlotIds: get().closedSlotIds.filter((x) => x !== id) });
    persist(snap(get()));
  },

  deleteSlot: (id) => {
    if (get().bookings.some((b) => b.slotId === id)) {
      get().showToast("Есть записи — сначала отмените.");
      return;
    }
    const extraSlots = get().extraSlots.filter((s) => s.id !== id);
    set({
      extraSlots,
      slots: mergeSlots(extraSlots, slotViewer(get().clients, get().role)),
      closedSlotIds: get().closedSlotIds.filter((x) => x !== id),
    });
    persist(snap(get()));
  },

  addClient: (draft) => {
    const id = `c_${Date.now()}`;
    const client: Client = {
      ...emptyClient(),
      id,
      firstName: draft.firstName.trim(),
      lastName: (draft.lastName || "").trim(),
      telegramUsername: draft.telegramUsername?.replace(/^@/, "") || null,
      phone: draft.phone || null,
      coachId: String(getTelegramUser()?.id || TRAINER_TG_ID),
    };
    if (!client.firstName) return "";
    set({ clients: [...get().clients, client], activeClientId: id });
    persist(snap(get()));
    get().showToast("Клиент добавлен.");
    return id;
  },

  claimByPhone: async (phone) => {
    const digits = digitsPhone(phone);
    if (digits.length < 10) return false;
    const clients = get().clients.map((c) => {
      if (digitsPhone(c.phone || "") !== digits) return c;
      const me = getTelegramUser();
      return {
        ...c,
        telegramId: me?.id ? String(me.id) : c.telegramId,
        telegramUsername: me?.username || c.telegramUsername,
      };
    });
    set({ clients });
    persist(snap(get()));
    return true;
  },

  removeClient: (id) => {
    const removedClientIds = [...new Set([...get().removedClientIds, id])];
    set({
      clients: get().clients.filter((c) => c.id !== id),
      removedClientIds,
      activeClientId: get().activeClientId === id ? get().clients.find((c) => c.id !== id)?.id ?? "" : get().activeClientId,
    });
    persist(snap(get()));
  },

  updateClient: (id, patch) => {
    set({
      clients: get().clients.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
    persist(snap(get()));
  },

  dismissSignal: (id) => {
    set({ dismissedSignalIds: [...get().dismissedSignalIds, id] });
    persist(snap(get()));
  },

  setNotifyPrefs: (patch) => {
    set({ notifyPrefs: { ...get().notifyPrefs, ...patch } });
    persist(snap(get()));
  },

  showToast: (msg) => set({ toast: msg }),
  clearToast: () => set({ toast: null }),
  openNote: () => set({ noteOpen: true }),
  closeNote: () => set({ noteOpen: false }),
  openGuestPreview: () => set({ guestPreview: true }),
  closeGuestPreview: () => set({ guestPreview: false }),
}));
