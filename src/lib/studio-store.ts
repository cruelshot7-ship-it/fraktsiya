import { create } from "zustand";
// RESTORE_MARKER — file too large for single message; use blob API
export type TabId = "today" | "schedule" | "program" | "more" | "slots" | "bookings" | "food" | "form" | "hall" | "clients" | "signals";
export type Role = "client" | "trainer";
export const useStudio = create(() => ({ tab: "today" as TabId, role: "client" as Role }));
export function activeClient() { return undefined; }
export function slotTaken() { return 0; }
