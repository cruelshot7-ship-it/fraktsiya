/**
 * Optimistic concurrency for the studio row (Neon is the source of truth).
 *
 * The payload carries `rev`. A save writes `rev + 1`, and only lands if the stored row still has the
 * `rev` the state was read with. Two requests that read the same revision cannot both win: the second
 * write is refused and its caller reads again. Pure, so it runs under node --test.
 */

export type Revisioned = { rev?: number };

/** The revision a payload was read with. Rows written before revisions existed count as 0. */
export function readRevision(p: Revisioned | null | undefined): number {
  const n = p?.rev;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : 0;
}

/** The revision a save writes: one more than the one it was read with. */
export function nextRevision(p: Revisioned | null | undefined): number {
  return readRevision(p) + 1;
}

/** Rows without `rev` predate revisions: the Telegram copy (the truth until now) is taken for them. */
export function isRevisioned(p: Revisioned | null | undefined): boolean {
  return typeof p?.rev === "number";
}
