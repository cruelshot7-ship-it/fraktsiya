
import { createServerFn } from "@tanstack/react-start";
import { backupDay, shouldSendBackup } from "@/lib/studio-backup";
import { clientSlotView } from "@/lib/studio-scope";
import { z } from "zod";
import { mergeBookingFlags, ownDismissed, unionIds } from "@/lib/studio-merge";
import {
  clientCoach,
  coachKey,
  coachPhase,
  COACH_PAID_DAYS,
  COACH_TRIAL_CAP,
  emptyClient,
  hoursAgoIso,
  digitsPhone,
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
  phone: z.string().optional(),
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
      address: "",
    },
    waitlist: [],
    workoutLogs: [],
    checks: {},
    trainerUsername: null,
    joinRequests: [],
    removedClientIds: [],
    coaches: [],
    visits: [],
  };
}

// ===== TEMPORARY STUBS (restore full implementation later) =====
export async function loadStudioState(): Promise<StudioPayload> {
  return emptyPayload();
}

export async function saveStudioState(_payload: StudioPayload): Promise<void> {}

export async function pullStudio(_initData?: string): Promise<StudioPayload> {
  return emptyPayload();
}

export async function pushStudio(_payload: StudioPayload, _initData?: string): Promise<void> {}

export function dropTombstones(payload: StudioPayload): StudioPayload {
  return payload;
}

export function ensureApprovedClients(payload: StudioPayload): StudioPayload {
  return payload;
}

export function isRemovedClient(_c: Client, _removed: string[]): boolean {
  return false;
}

export function mergeClients(primary: Client[], secondary: Client[]): Client[] {
  return [...primary, ...secondary];
}

export function tombstonesFor(_payload: StudioPayload): string[] {
  return [];
}

export const requestJoin = createServerFn({ method: "POST" }).handler(async () => ({}));
export const addCoachFn = createServerFn({ method: "POST" }).handler(async () => ({}));
export const removeCoachFn = createServerFn({ method: "POST" }).handler(async () => ({}));
export const payCoachFn = createServerFn({ method: "POST" }).handler(async () => ({}));
export const decideJoinFn = createServerFn({ method: "POST" }).handler(async () => ({}));
export const sendBotLinkFn = createServerFn({ method: "POST" }).handler(async () => ({}));
export const sendTrainerNoteFn = createServerFn({ method: "POST" }).handler(async () => ({}));

export const studioHealth = createServerFn({ method: "GET" }).handler(async () => ({
  bot: false,
  db: "pglite" as const,
}));
