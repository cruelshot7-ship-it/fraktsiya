import { create } from "zustand";
// HOTFIX loader: real store will be restored from parts in next commit
// Temporary minimal store so app boots and booking works
import {
  BOT_USERNAME,
  addDays,
  DOW,
  formatDayMonth,
  formatLongDate,
  hoursAgoIso,
  isoDate,
  isFrozen,
  isSlotPast,
  sessionsRu,
  shortName,
  type Booking,
  type Client,
  type Notice,
  type Slot,
  type WaitlistEntry,
} from "@/data/studio";

export type TabId =
  | "today"
  | "schedule"
  | "program"
  | "more"
  | "slots"
  | "bookings"
  | "food"
  | "form"
  | "hall"
  | "clients"
  | "signals";

type Role = "client" | "trainer";

type State = {
  role: Role;
  tab: TabId;
  clients: Client[];
  slots: Slot[];
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  notices: Notice[];
  closedSlotIds: string[];
  activeClientId: string | null;
  weekStart: string;
  selectedDate: string;
  selectedSlotId: string | null;
  toast: string | null;
  sheetClientId: string | null;
  inviteBlocked: boolean;
  guestPreview: boolean;
  noteOpen: boolean;
  dismissedSignalIds: string[];
  joinRequests: { id: string; status: string; name?: string }[];
  coaches: { id: string; name: string; pause?: boolean }[];
  clientFilter: string;
  food: unknown[];
  hydrate: () => void;
  refreshCloud: () => void;
  setRole: (r: Role) => void;
  setTab: (t: TabId) => void;
  selectDay: (d: string) => void;
  shiftWeek: (n: number) => void;
  bookSlot: (id: string, forClientId?: string) => boolean;
  joinWaitlist: (id: string) => void;
  leaveWaitlist: (id: string) => void;
  showToast: (m: string) => void;
  openClientSheet: (id: string | null) => void;
  openNote: () => void;
  closeNote: () => void;
  openGuestPreview: () => void;
  closeGuestPreview: () => void;
  dismissSignal: (id: string) => void;
  setClientFilter: (v: string) => void;
  addClient: (c: Partial<Client>) => void;
  approveJoin: (id: string) => void;
  rejectJoin: (id: string) => void;
  addCoach: (n: string, u: string) => void;
  removeCoach: (id: string) => void;
  payCoach: (id: string) => void;
};

function loadLocal(): Partial<State> {
  try {
    const raw = localStorage.getItem("ruksha_studio_v1");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function persist(s: State) {
  try {
    const snap = {
      role: s.role,
      tab: s.tab,
      clients: s.clients,
      slots: s.slots,
      bookings: s.bookings,
      waitlist: s.waitlist,
      notices: s.notices,
      closedSlotIds: s.closedSlotIds,
      activeClientId: s.activeClientId,
      weekStart: s.weekStart,
      selectedDate: s.selectedDate,
      dismissedSignalIds: s.dismissedSignalIds,
      joinRequests: s.joinRequests,
      coaches: s.coaches,
    };
    localStorage.setItem("ruksha_studio_v1", JSON.stringify(snap));
  } catch {}
}

export function activeClient(s: { clients: Client[]; activeClientId: string | null }) {
  return s.clients.find((c) => c.id === s.activeClientId) ?? s.clients[0] ?? null;
}

export function slotTaken(slot: Slot, bookings: Booking[]) {
  return bookings.filter((b) => b.slotId === slot.id && !b.noShow).length;
}

let slotBusy = false;

export const useStudio = create<State>((set, get) => {
  const today = isoDate(new Date());
  const local = typeof window !== "undefined" ? loadLocal() : {};
  return {
    role: (local.role as Role) || "client",
    tab: (local.tab as TabId) || "today",
    clients: (local.clients as Client[]) || [],
    slots: (local.slots as Slot[]) || [],
    bookings: (local.bookings as Booking[]) || [],
    waitlist: (local.waitlist as WaitlistEntry[]) || [],
    notices: (local.notices as Notice[]) || [],
    closedSlotIds: (local.closedSlotIds as string[]) || [],
    activeClientId: (local.activeClientId as string | null) ?? null,
    weekStart: (local.weekStart as string) || today,
    selectedDate: (local.selectedDate as string) || today,
    selectedSlotId: null,
    toast: null,
    sheetClientId: null,
    inviteBlocked: false,
    guestPreview: false,
    noteOpen: false,
    dismissedSignalIds: (local.dismissedSignalIds as string[]) || [],
    joinRequests: (local.joinRequests as State["joinRequests"]) || [],
    coaches: (local.coaches as State["coaches"]) || [],
    clientFilter: "",
    food: [],
    hydrate: () => {
      const l = loadLocal();
      set({
        clients: (l.clients as Client[]) || get().clients,
        slots: (l.slots as Slot[]) || get().slots,
        bookings: (l.bookings as Booking[]) || get().bookings,
        waitlist: (l.waitlist as WaitlistEntry[]) || get().waitlist,
        notices: (l.notices as Notice[]) || get().notices,
        closedSlotIds: (l.closedSlotIds as string[]) || get().closedSlotIds,
        activeClientId: (l.activeClientId as string | null) ?? get().activeClientId,
        weekStart: (l.weekStart as string) || get().weekStart,
        selectedDate: (l.selectedDate as string) || get().selectedDate,
      });
    },
    refreshCloud: () => {},
    setRole: (r) => {
      set({ role: r });
      persist(get());
    },
    setTab: (t) => {
      set({ tab: t });
      persist(get());
    },
    selectDay: (d) => set({ selectedDate: d }),
    shiftWeek: (n) => {
      const cur = get().weekStart;
      const next = isoDate(addDays(new Date(cur + "T12:00:00"), n * 7));
      set({ weekStart: next });
      persist(get());
    },
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
        const booking: Booking = {
          id: `bk_${slot.id}_${client.id}`,
          slotId: slot.id,
          clientId: client.id,
          date: slot.date,
          time: slot.time,
          duration: slot.duration,
          held: true,
        };
        const left = Math.max(0, (client.sessionsLeft ?? 0) - 1);
        const nextClients = clients.map((c) =>
          c.id === client.id ? { ...c, sessionsLeft: left } : c,
        );
        const nextNotices: Notice[] = [
          ...notices,
          {
            id: `nt_book_${booking.id}`,
            audience: "trainer",
            clientId: client.id,
            kind: "book",
            title: `Новая запись: ${shortName(client)}`,
            body: `${formatLongDate(slot.date)} · ${slot.time} · осталось ${left} ${sessionsRu(left)}`,
            at: hoursAgoIso(0),
          },
        ];
        set({
          bookings: [...bookings, booking],
          selectedSlotId: slot.id,
          notices: nextNotices,
          clients: nextClients,
          waitlist: waitlist.filter((w) => !(w.slotId === slot.id && w.clientId === client.id)),
        });
        persist(get());
        const dow = DOW[(new Date(slot.date + "T12:00:00").getDay() + 6) % 7].toLowerCase();
        get().showToast(
          role === "trainer"
            ? `Запись: ${client.firstName} · ${dow} ${slot.time}`
            : `Готово. Встретимся ${dow} в ${slot.time}.`,
        );
        // Dual-write to Neon (best-effort)
        try {
          void fetch("/api/book-slot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              slotId: slot.id,
              clientId: client.id,
              date: slot.date,
              time: slot.time,
              duration: slot.duration,
              bookingId: booking.id,
            }),
          });
        } catch {}
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
      persist(get());
      get().showToast(`В листе на ${slot.time}.`);
    },
    leaveWaitlist: (slotId) => {
      const id = get().activeClientId;
      set({ waitlist: get().waitlist.filter((w) => !(w.slotId === slotId && w.clientId === id)) });
      persist(get());
    },
    showToast: (m) => {
      set({ toast: m });
      setTimeout(() => set({ toast: null }), 2800);
    },
    openClientSheet: (id) => set({ sheetClientId: id }),
    openNote: () => set({ noteOpen: true }),
    closeNote: () => set({ noteOpen: false }),
    openGuestPreview: () => set({ guestPreview: true }),
    closeGuestPreview: () => set({ guestPreview: false }),
    dismissSignal: (id) => {
      set({ dismissedSignalIds: [...get().dismissedSignalIds, id] });
      persist(get());
    },
    setClientFilter: (v) => set({ clientFilter: v }),
    addClient: () => get().showToast("Добавление клиента временно в упрощённом режиме"),
    approveJoin: () => {},
    rejectJoin: () => {},
    addCoach: () => {},
    removeCoach: () => {},
    payCoach: () => {},
  };
});
