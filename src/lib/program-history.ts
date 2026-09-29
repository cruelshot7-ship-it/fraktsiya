/** Lightweight program change history for client transparency. */

export type ProgramHistoryEntry = {
  id: string;
  clientId: string;
  at: string;
  kind: "progression" | "template" | "copy_day" | "manual" | "note";
  title: string;
  body: string;
};

export function appendHistory(
  list: ProgramHistoryEntry[],
  entry: Omit<ProgramHistoryEntry, "id" | "at"> & { id?: string; at?: string },
  max = 40,
): ProgramHistoryEntry[] {
  const row: ProgramHistoryEntry = {
    id: entry.id ?? `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at ?? new Date().toISOString(),
    clientId: entry.clientId,
    kind: entry.kind,
    title: entry.title,
    body: entry.body,
  };
  return [row, ...list].slice(0, max);
}

export function historyForClient(
  list: ProgramHistoryEntry[],
  clientId: string,
): ProgramHistoryEntry[] {
  return list.filter((e) => e.clientId === clientId).sort((a, b) => b.at.localeCompare(a.at));
}
