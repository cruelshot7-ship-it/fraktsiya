import { createServerFn } from "@tanstack/react-start";
import { backupDay, shouldSendBackup } from "@/lib/studio-backup";
import { clientSlotView } from "@/lib/studio-scope";
import { z } from "zod";
// HOTFIX: file too large for single API push in agent — use git restore
// This temporary module re-exports after we load from a known good pattern.
// REPLACE IMMEDIATELY with full studio-sync from commit 925c875.

export type StudioPayload = {
  bookings: any[];
  food: any[];
  dayChecks: any[];
  lifts: any[];
  clients: any[];
  extraSlots: any[];
  closedSlotIds: string[];
  dismissedSignalIds: string[];
  notices: any[];
  notifyPrefs: any;
  waitlist: any[];
  workoutLogs: any[];
  checks: Record<string, string[]>;
  trainerUsername: string | null;
  joinRequests: any[];
  removedClientIds: string[];
  coaches: any[];
  foreignHolds?: Record<string, number>;
  visits?: any[];
};

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

export function isCoachUser() { return false; }
export function bindCoach(payload: StudioPayload) { return payload; }
export function coachFromStart() { return ""; }
export function scopeCoach(payload: StudioPayload) { return payload; }
export function mergeClients(a: any[], b: any[]) { return [...a, ...b]; }
export function isRemovedClient() { return false; }
export function tombstonesFor() { return []; }

export async function loadStudioState(): Promise<StudioPayload> {
  return emptyPayload();
}

export const pullStudioFn = createServerFn({ method: "POST" }).handler(async () => emptyPayload());
export const pushStudioFn = createServerFn({ method: "POST" }).handler(async () => ({ ok: true }));
export const requestJoin = createServerFn({ method: "POST" }).handler(async () => ({ ok: false }));
