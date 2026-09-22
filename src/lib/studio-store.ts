import { create } from "zustand";
import {
  addDays,
  DEFAULT_NOTIFY,
  DOW,
  emptyClient,
  firstBookableDate,
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
  type LiftLog,
  type Meal,
  type Notice,
  type NotifyPrefs,
  type SessionTxn,
  type Slot,
  type WaitlistEntry,
  type WorkoutLog,
  workoutKcal,
} from "@/data/studio";

import { hapticNotify } from "@/lib/haptics";
import { applyTelegramIdentity, scheduleCloudPush, syncFromCloud, telegramLocked } from "@/lib/studio-identity";
import { mergeClients } from "@/lib/studio-sync";
import { stripDemoData } from "@/lib/studio-clean";
import { getTelegramUser } from "@/lib/telegram";

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
  inviteBlocked: boolean;
  toast: string | null;
  hydrate: () => void;
  refreshCloud: () => void;
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
  completeWorkout: (totalItems: number, minutes?: number) => void;
  setWeight: (kg: number) => void;
  addSlot: (date: string, time: string, capacity: number) => void;
  closeSlot: (id: string) => void;
  openSlot: (id: string) => void;
  deleteSlot: (id: string) => void;
  addClient: (draft: { firstName: string; lastName: string; telegramUsername?: string }) => string;
  removeClient: (id: string) => void;
  updateClient: (id: string, patch: Partial<Client>) => void;
  dismissSignal: (id: string) => void;
  setNotifyPrefs: (patch: Partial<NotifyPrefs>) => void;
  showToast: (msg: string) => void;
  clearToast: () => void;
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

function persist(s: PersistShape) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota */
  }
  scheduleCloudPush(s);
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
  };
}

function mergeSlots(extra: Slot[]) {
  const base = generateWindow(startOfWeek(new Date()), 42);
  const map = new Map(base.map((s) => [s.id, s]));
  for (const slot of extra) map.set(slot.id, slot);
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
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
  inviteBlocked: false,
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
        activeClientId =
          parsed.activeClientId && clients.some((c) => c.id === parsed.activeClientId)
            ? parsed.activeClientId
            : clients[0]?.id ?? "";
        extraSlots = parsed.extraSlots ?? [];
        closedSlotIds = parsed.closedSlotIds ?? [];
        dismissedSignalIds = parsed.dismissedSignalIds ?? [];
        notices = parsed.notices ?? [];
        notifyPrefs = { ...DEFAULT_NOTIFY, ...parsed.notifyPrefs };
        waitlist = parsed.waitlist ?? [];
        workoutLogs = parsed.workoutLogs ?? [];
        checks = parsed.checks ?? {};
        trainerUsername = parsed.trainerUsername ?? null;
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
      inviteBlocked,
      tab: role === "trainer" ? "clients" : "slots",
    });
    void syncFromCloud().then((cloud) => {
      if (!cloud) return;
      const payload = cloud.payload;
      const extra = payload.extraSlots ?? [];
      set({
        role: cloud.role,
        inviteBlocked: Boolean(cloud.blocked),
        clients: cloud.blocked ? get().clients : mergeClients(get().clients, payload.clients),
        activeClientId:
          cloud.role === "client" && payload.clients[0]
            ? payload.clients[0].id
            : get().activeClientId,
        bookings: payload.bookings,
        food: payload.food,
        lifts: payload.lifts,
        extraSlots: extra,
        closedSlotIds: payload.closedSlotIds,
        notices: payload.notices,
        dismissedSignalIds: payload.dismissedSignalIds,
        notifyPrefs: payload.notifyPrefs,
        waitlist: payload.waitlist,
        workoutLogs: payload.workoutLogs,
        checks: payload.checks,
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        slots: mergeSlots(extra),
        tab: cloud.role === "trainer" ? "clients" : get().tab === "clients" || get().tab === "signals" ? "slots" : get().tab,
      });
      persist(snap(get()));
      if (cloud.created) get().showToast("Заявка у тренера. Ждите пакет занятий.");
    });
  },

  refreshCloud: () => {
    void syncFromCloud().then((cloud) => {
      if (!cloud) return;
      const payload = cloud.payload;
      const extra = payload.extraSlots ?? get().extraSlots;
      set({
        role: cloud.role,
        inviteBlocked: Boolean(cloud.blocked),
        clients: cloud.blocked ? get().clients : mergeClients(get().clients, payload.clients),
        bookings: payload.bookings.length ? payload.bookings : get().bookings,
        food: payload.food.length ? payload.food : get().food,
        lifts: payload.lifts.length ? payload.lifts : get().lifts,
        extraSlots: extra,
        closedSlotIds: payload.closedSlotIds.length ? payload.closedSlotIds : get().closedSlotIds,
        notices: payload.notices.length ? payload.notices : get().notices,
        workoutLogs: payload.workoutLogs.length ? payload.workoutLogs : get().workoutLogs,
        trainerUsername: payload.trainerUsername ?? get().trainerUsername,
        slots: extra.length ? mergeSlots(extra) : get().slots,
      });
      persist(snap(get()));
    });
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

  toggleCheck: (item) => {
    const id = get().activeClientId;
    const key = `${id}:${todayIso()}`;
    const current = get().checks[key] ?? [];
    const next = current.includes(item) ? current.filter((x) => x !== item) : [...current, item];
    set({ checks: { ...get().checks, [key]: next } });
    persist(snap(get()));
  },

  completeWorkout: (totalItems, minutes) => {
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
    const mins = minutes ?? booking?.duration ?? 60;
    const volume = lifts
      .filter((l) => l.clientId === client.id && l.date === today)
      .reduce((sum, l) => sum + l.weight * l.reps * l.sets, 0);
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
    get().showToast(`Тренировка закрыта \u00b7 ${kcal} ккал`);
  },


  bookSlot: (slotId, forClientId) => {
    const { slots, bookings, activeClientId, clients, waitlist } = get();
    const slot = slots.find((s) => s.id === slotId);
    const client = clients.find((c) => c.id === (forClientId ?? activeClientId));
    if (!slot || !client) return false;
    if (isSlotPast(slot.date, slot.time) || isFrozen(client) || (client.sessionsLeft ?? 0) <= 0) {
      get().showToast("Сейчас записаться нельзя.");
      return false;
    }
    if (slotTaken(slot, bookings) >= slot.capacity) {
      get().showToast("Слот занят.");
      return false;
    }
    const booking = {
      id: `bk_${slot.id}_${client.id}_${Date.now()}`,
      slotId: slot.id,
      clientId: client.id,
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      held: true,
    };
    const hold = makeTxn(client.id, "hold", -1, `Запись ${slot.date} ${slot.time}`, booking.id);
    set({
      bookings: [...bookings, booking],
      clients: withTxn(clients, hold),
      waitlist: waitlist.filter((w) => !(w.slotId === slot.id && w.clientId === client.id)),
    });
    persist(snap(get()));
    get().showToast(`Готово. ${slot.time}.`);
    return true;
  },
  joinWaitlist: (slotId) => {
    const { waitlist, activeClientId } = get();
    if (waitlist.some((w) => w.slotId === slotId && w.clientId === activeClientId)) return;
    set({ waitlist: [...waitlist, { id: `wl_${slotId}_${activeClientId}`, slotId, clientId: activeClientId, at: new Date().toISOString() }] });
    persist(snap(get()));
    get().showToast("В листе ожидания.");
  },
  leaveWaitlist: (slotId) => {
    const id = get().activeClientId;
    set({ waitlist: get().waitlist.filter((w) => !(w.slotId === slotId && w.clientId === id)) });
    persist(snap(get()));
  },
  cancelBooking: (id) => {
    const { bookings, clients } = get();
    const booking = bookings.find((b) => b.id === id);
    if (!booking) return;
    const refund = makeTxn(booking.clientId, "refund", 1, "Отмена", booking.id);
    set({ bookings: bookings.filter((b) => b.id !== id), clients: withTxn(clients, refund) });
    persist(snap(get()));
    get().showToast("Запись снята.");
  },
  addFood: (mealId) => {
    const meal = MEALS.find((m) => m.id === mealId);
    if (!meal) return;
    const log = { ...meal, logId: `f_${Date.now()}`, date: todayIso(), clientId: get().activeClientId };
    set({ food: [...get().food, log] });
    persist(snap(get()));
  },
  addCustomFood: (meal) => {
    const log = { ...meal, id: `c_${Date.now()}`, logId: `f_${Date.now()}`, date: todayIso(), clientId: get().activeClientId };
    set({ food: [...get().food, log] });
    persist(snap(get()));
  },
  removeFood: (logId) => {
    set({ food: get().food.filter((f) => f.logId !== logId) });
    persist(snap(get()));
  },
  markNoShow: (bookingId) => {
    set({ bookings: get().bookings.map((b) => (b.id === bookingId ? { ...b, noShow: true } : b)) });
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
  addClient: (draft) => {
    const firstName = draft.firstName.trim();
    const lastName = draft.lastName.trim();
    if (!firstName) {
      get().showToast("Напишите имя.");
      return "";
    }
    const c = {
      ...emptyClient(),
      firstName,
      lastName,
      telegramUsername: draft.telegramUsername?.replace(/^@/, "").trim() || null,
    };
    set({ clients: [...get().clients, c], activeClientId: c.id, sheetClientId: c.id });
    persist(snap(get()));
    get().showToast("Клиент добавлен. Назначьте пакет и программу.");
    return c.id;
  },
  creditSessions: (clientId, amount) => {
    const txn = makeTxn(clientId, "credit", amount, `Пакет +${amount}`);
    set({ clients: withTxn(get().clients, txn) });
    persist(snap(get()));
  },
  freezeClient: (clientId, days) => {
    set({
      clients: get().clients.map((c) =>
        c.id === clientId ? { ...c, frozenUntil: isoDate(addDays(new Date(), days)) } : c,
      ),
    });
    persist(snap(get()));
  },
  unfreezeClient: (clientId) => {
    set({ clients: get().clients.map((c) => (c.id === clientId ? { ...c, frozenUntil: null } : c)) });
    persist(snap(get()));
  },
  updateClient: (id, patch) => {
    set({ clients: get().clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    persist(snap(get()));
  },
  checkIn: (bookingId) => {
    set({ bookings: get().bookings.map((b) => (b.id === bookingId ? { ...b, checkedIn: true, noShow: false } : b)) });
    persist(snap(get()));
    get().showToast("Отметили: вы в зале.");
  },
  addLift: (exercise, weight, reps, sets) => {
    set({
      lifts: [...get().lifts, { id: `lift_${Date.now()}`, date: todayIso(), exercise, weight, reps, sets, clientId: get().activeClientId }],
    });
    persist(snap(get()));
  },
  setWeight: (kg) => {
    const id = get().activeClientId;
    const today = todayIso();
    set({
      clients: get().clients.map((c) =>
        c.id === id ? { ...c, weight: kg, weightHistory: [...c.weightHistory, { date: today, kg }] } : c,
      ),
    });
    persist(snap(get()));
  },
  addSlot: (date, time, capacity) => {
    const id = `${date}_${time}`;
    const slot = { id, date, time, duration: 60, capacity, seeded: 0 };
    const extraSlots = [...get().extraSlots.filter((s) => s.id !== id), slot];
    const closedSlotIds = get().closedSlotIds.filter((x) => x !== id);
    set({ extraSlots, closedSlotIds, slots: mergeSlots(extraSlots) });
    persist(snap(get()));
  },
  deleteSlot: (id) => {
    get().cancelSlotBookings(id);
    const extraSlots = get().extraSlots.filter((s) => s.id !== id);
    const closedSlotIds = get().closedSlotIds.includes(id) ? get().closedSlotIds : [...get().closedSlotIds, id];
    set({ extraSlots, closedSlotIds, slots: mergeSlots(extraSlots) });
    persist(snap(get()));
    get().showToast("Слот удалён.");
  },
  closeSlot: (id) => {
    set({ closedSlotIds: [...new Set([...get().closedSlotIds, id])] });
    persist(snap(get()));
  },
  openSlot: (id) => {
    set({ closedSlotIds: get().closedSlotIds.filter((x) => x !== id) });
    persist(snap(get()));
  },
  removeClient: (id) => {
    set({
      clients: get().clients.filter((c) => c.id !== id),
      sheetClientId: get().sheetClientId === id ? null : get().sheetClientId,
    });
    persist(snap(get()));
  },
  cancelSlotBookings: (slotId) => {
    for (const b of get().bookings.filter((x) => x.slotId === slotId && !isSlotPast(x.date, x.time))) {
      get().cancelBooking(b.id, "trainer");
    }
  },
  rescheduleBooking: (id, newSlotId) => {
    const { bookings, slots } = get();
    const booking = bookings.find((b) => b.id === id);
    const slot = slots.find((s) => s.id === newSlotId);
    if (!booking || !slot) return false;
    set({
      bookings: bookings.map((b) =>
        b.id === id ? { ...b, slotId: slot.id, date: slot.date, time: slot.time, duration: slot.duration } : b,
      ),
    });
    persist(snap(get()));
    return true;
  },

  showToast: (toast) => {
    set({ toast });
    window.setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2200);
  },
  clearToast: () => set({ toast: null }),
}));
