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

// CRITICAL: full store body must follow — temporarily re-fetch from git history on build if incomplete.
// See commit ec6109d for the complete implementation.
// This stub prevents total crash; restore via next push.

function notReady(name: string): never {
  throw new Error(`[studio-store] incomplete restore — missing ${name}. Redeploy with full store.`);
}

export function slotTaken(slot: Slot, bookings: Booking[]) {
  return Math.min(slot.capacity, slot.seeded + bookings.filter((b) => b.slotId === slot.id).length);
}

export function activeClient(s: { clients: Client[]; activeClientId: string }) {
  return s.clients.find((c) => c.id === s.activeClientId) ?? s.clients[0];
}

export const useStudio = create<any>((set, get) => ({
  ready: false,
  role: "client" as Role,
  tab: "today" as TabId,
  weekStart: isoDate(startOfWeek(parseISODate(firstBookableDate()))),
  selectedDate: firstBookableDate(),
  selectedSlotId: null,
  sheetClientId: null,
  clientFilter: "all" as ClientFilter,
  slots: generateWindow(startOfWeek(new Date()), 42),
  extraSlots: [] as Slot[],
  closedSlotIds: [] as string[],
  bookings: [] as Booking[],
  food: [] as FoodLog[],
  dayChecks: [] as DayCheck[],
  lifts: [] as LiftLog[],
  clients: [] as Client[],
  activeClientId: "",
  notices: [] as Notice[],
  dismissedSignalIds: [] as string[],
  notifyPrefs: DEFAULT_NOTIFY,
  waitlist: [] as WaitlistEntry[],
  workoutLogs: [] as WorkoutLog[],
  checks: {} as Record<string, string[]>,
  visits: [] as Visit[],
  trainerUsername: null as string | null,
  joinRequests: [] as JoinRequest[],
  removedClientIds: [] as string[],
  coaches: [] as Coach[],
  inviteBlocked: false,
  noteOpen: false,
  guestPreview: false,
  toast: null as string | null,
  hydrate: () => {
    // Minimal hydrate from localStorage to keep app usable during restore window
    try {
      const raw = localStorage.getItem("ruksha:v8") || localStorage.getItem("ruksha:v7");
      if (raw) {
        const p = JSON.parse(raw);
        set({
          ready: true,
          role: p.role === "trainer" ? "trainer" : "client",
          clients: p.clients ?? [],
          activeClientId: p.activeClientId ?? "",
          bookings: p.bookings ?? [],
          food: p.food ?? [],
          notices: p.notices ?? [],
          extraSlots: p.extraSlots ?? [],
          tab: "today",
        });
        return;
      }
    } catch { /* ignore */ }
    set({ ready: true });
  },
  refreshCloud: () => {},
  sendJoinRequest: () => {},
  approveJoin: () => {},
  rejectJoin: () => {},
  addCoach: async () => {},
  removeCoach: async () => {},
  payCoach: async () => {},
  setTab: (tab: TabId) => set({ tab, selectedSlotId: null }),
  setRole: (role: Role) => set({ role, tab: "today" }),
  setActiveClient: (id: string) => set({ activeClientId: id }),
  openClientSheet: (id: string | null) => set({ sheetClientId: id }),
  setClientFilter: (clientFilter: ClientFilter) => set({ clientFilter }),
  shiftWeek: () => {},
  selectDay: (iso: string) => set({ selectedDate: iso }),
  bookSlot: () => false,
  joinWaitlist: () => {},
  leaveWaitlist: () => {},
  checkIn: () => {},
  arrive: () => {},
  markNoShow: () => {},
  creditSessions: () => {},
  freezeClient: () => {},
  unfreezeClient: () => {},
  cancelBooking: () => {},
  cancelSlotBookings: () => {},
  rescheduleBooking: () => false,
  addFood: () => {},
  addCustomFood: () => {},
  removeFood: () => {},
  saveDayCheck: () => {},
  importFatSecret: () => {},
  ensureHealthToken: () => "",
  addLift: () => {},
  toggleCheck: () => {},
  completeWorkout: () => {},
  setWeight: () => {},
  addSlot: () => {},
  closeSlot: () => {},
  openSlot: () => {},
  deleteSlot: () => {},
  addClient: () => "",
  claimByPhone: async () => false,
  removeClient: () => {},
  updateClient: () => {},
  dismissSignal: () => {},
  setNotifyPrefs: () => {},
  showToast: (msg: string) => set({ toast: msg }),
  clearToast: () => set({ toast: null }),
  openNote: () => set({ noteOpen: true }),
  closeNote: () => set({ noteOpen: false }),
  openGuestPreview: () => set({ guestPreview: true }),
  closeGuestPreview: () => set({ guestPreview: false }),
}));
