/**
 * Local fallback when Neon session_results is unavailable.
 * Dual-write companion — not a CRDT.
 */
const KEY = "ruksha_session_results_v1";

export type LocalSessionResult = {
  id: string;
  bookingId: string;
  clientId: string;
  coachId: string;
  programId?: string;
  sets: {
    exercise: string;
    load: number;
    unit: string;
    reps: number;
    targetRepsMin: number;
    targetRepsMax: number;
    setsCompleted: number;
    setsPlanned: number;
  }[];
  rpe?: number;
  notes?: string;
  at: string;
};

export function loadLocalResults(): LocalSessionResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalSessionResult[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalResult(entry: LocalSessionResult): LocalSessionResult {
  const all = loadLocalResults().filter((r) => r.bookingId !== entry.bookingId);
  all.unshift(entry);
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 100)));
  return entry;
}

export function findLocalResult(bookingId: string): LocalSessionResult | undefined {
  return loadLocalResults().find((r) => r.bookingId === bookingId);
}
