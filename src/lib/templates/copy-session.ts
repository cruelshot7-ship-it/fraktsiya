import type { ProgramSession } from "@/data/studio";

/** Independent snapshot of a past program day. */
export function copySessionAsNew(
  source: ProgramSession,
  opts?: { id?: string; nameSuffix?: string },
): ProgramSession {
  const suffix = opts?.nameSuffix ?? " · копия";
  return {
    id: opts?.id ?? `copy_${source.id}_${Date.now()}`,
    name: `${source.name}${suffix}`,
    focus: source.focus,
    items: [...source.items],
  };
}

export function appendCopiedSession(
  sessions: ProgramSession[],
  sourceId: string,
): ProgramSession[] | null {
  const src = sessions.find((s) => s.id === sourceId);
  if (!src) return null;
  return [...sessions, copySessionAsNew(src)];
}
