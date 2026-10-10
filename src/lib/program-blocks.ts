/**
 * Program blocks: a training visit is an ordered list of exercise blocks.
 * Pure, no imports, so it runs under node --test and in the app alike.
 *
 * Storage: a session keeps `items` (plain lines, the format older readers and
 * templates use) and, from stage 2 on, `blocks`. The trainer's editor writes both.
 * When the two disagree (an older writer changed `items`), the lines win and the
 * blocks are read back from them. Marks and facts written before blocks existed
 * are keyed by line position ("3:Тяга"); they are rewritten to block ids on read.
 */

/** Work per side: each arm, each leg, or each side. Sets are counted for both sides. */
export type Side = "руку" | "ногу" | "сторону";
export const SIDES: Side[] = ["руку", "ногу", "сторону"];

export type ProgramBlock = {
  id: string;
  /** exercise name, free text or from the trainer's list */
  exercise: string;
  /** number of sets, 0 when the block has no sets scheme */
  sets: number;
  /** "8", "8-10"; "" when none */
  reps: string;
  /** "60", "60-70", "62,5"; "" for bodyweight */
  load: string;
  /** seconds of rest after the block, null when not set */
  rest: number | null;
  /** "на каждую руку / ногу / сторону": sets are counted for both sides; null for a single side */
  side: Side | null;
  /** blocks with the same group are one superset card; null for a single block */
  group: string | null;
};

export type SessionLike = { items: string[]; blocks?: ProgramBlock[] };
export type Plan = { blocks: ProgramBlock[]; owner: string[] };

type Parsed =
  | { kind: "rest"; rest: number }
  | { kind: "scheme"; sets: number; reps: string; side: Side | null }
  | { kind: "weight"; load: string }
  | { kind: "text" };

/** Same precedence as the old line reader: rest, then sets scheme, then weight, else text. */
function parseLine(text: string): Parsed {
  // "Отдых" contains a Cyrillic х: rest is read before the х -> x normalization, or it never matches.
  const lower = text.trim().toLowerCase();
  const rest = /отдых\s*(\d+)/.exec(lower);
  if (rest) return { kind: "rest", rest: Number(rest[1]) };
  const raw = lower.replace(/х/g, "x").replace(/×/g, "x").replace(/[–—]/g, "-");
  const scheme = /(\d+)\s*x\s*(\d+(?:\s*-\s*\d+)?)/.exec(raw);
  if (scheme) return { kind: "scheme", sets: Number(scheme[1]), reps: scheme[2].replace(/\s+/g, ""), side: sideOf(raw) };
  const weight = /(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s*кг/.exec(raw);
  if (weight) return { kind: "weight", load: weight[1].replace(/\s+/g, "") };
  return { kind: "text" };
}

/** "на каждую руку" -> руку; other "кажд…" wording without a known noun means a side. */
function sideOf(raw: string): Side | null {
  if (!/кажд/.test(raw)) return null;
  const m = /кажд\S*\s+(руку|ногу|сторону)/.exec(raw);
  return m ? (m[1] as Side) : "сторону";
}

function blank(id: string, exercise: string): ProgramBlock {
  return { id, exercise, sets: 0, reps: "", load: "", rest: null, side: null, group: null };
}

/** Reads plain lines into blocks. A text line starts a block; sets, load and rest attach to it. */
function parseWithOwners(items: string[]): Plan {
  const blocks: ProgramBlock[] = [];
  const owner: string[] = [];
  let cur: ProgramBlock | null = null;
  for (let index = 0; index < items.length; index += 1) {
    const line = items[index].trim();
    if (!line) {
      owner.push("");
      continue;
    }
    const bit = parseLine(line);
    const attach =
      cur !== null &&
      bit.kind !== "text" &&
      ((bit.kind === "scheme" && cur.sets === 0 && cur.reps === "") ||
        (bit.kind === "weight" && cur.load === "") ||
        (bit.kind === "rest" && cur.rest === null));
    if (attach && cur) {
      if (bit.kind === "scheme") {
        cur.sets = bit.sets;
        cur.reps = bit.reps;
        cur.side = bit.side;
      } else if (bit.kind === "weight") cur.load = bit.load;
      else if (bit.kind === "rest") cur.rest = bit.rest;
    } else {
      // a text line, or a sets/load/rest line with nothing to attach to, starts a block.
      // Such a line keeps its own text as the name, so the derived line equals the source.
      cur = blank(`b${index}`, line);
      blocks.push(cur);
    }
    owner.push(cur.id);
  }
  return { blocks, owner };
}

/** The lines a block stands for. Derived lines round-trip through blocksFromItems. */
export function blockLines(b: ProgramBlock): string[] {
  const out: string[] = [];
  const name = b.exercise.trim();
  if (name) out.push(name);
  if (b.sets > 0 && b.reps) out.push(`${b.sets}×${b.reps}${b.side ? ` на каждую ${b.side}` : ""}`);
  if (b.load) out.push(`${b.load} кг`);
  if (b.rest != null && b.rest > 0) out.push(`Отдых ${b.rest} секунд`);
  return out;
}

export function itemsFromBlocks(blocks: ProgramBlock[]): string[] {
  return blocks.flatMap(blockLines);
}

export function blocksFromItems(items: string[]): ProgramBlock[] {
  return parseWithOwners(items).blocks;
}

function sameLines(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function newBlockId(): string {
  return `bl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Blocks of a session with, for every item line, the id of the block it belongs to. */
/** Blocks saved before `side` existed carried `perSide: boolean`; "на каждую руку" was their only wording. */
function fromStored(b: ProgramBlock): ProgramBlock {
  const legacy = b as ProgramBlock & { perSide?: boolean };
  if (legacy.side !== undefined) return b;
  const { perSide, ...rest } = legacy;
  return { ...rest, side: perSide ? "руку" : null };
}

export function sessionPlan(session: SessionLike): Plan {
  const items = session.items ?? [];
  const stored = session.blocks?.map(fromStored) ?? [];
  if (stored.length && sameLines(itemsFromBlocks(stored), items)) {
    return { blocks: stored, owner: stored.flatMap((b) => blockLines(b).map(() => b.id)) };
  }
  return parseWithOwners(items);
}

/** Session with blocks written and items derived from them. */
export function withBlocks<T extends SessionLike>(session: T, blocks: ProgramBlock[]): T {
  return { ...session, blocks, items: itemsFromBlocks(blocks) };
}

/** Maps a legacy mark "index:line" to the block id that owns that line. */
export function legacyMarkMap(session: SessionLike): Record<string, string> {
  const plan = sessionPlan(session);
  const map: Record<string, string> = {};
  (session.items ?? []).forEach((text, i) => {
    const id = plan.owner[i];
    if (id) map[`${i}:${text}`] = id;
  });
  return map;
}

/** Marks as block ids: legacy marks are rewritten, unknown ones are kept, duplicates removed. */
export function rewriteMarks(marks: string[], map: Record<string, string>): string[] {
  return [...new Set(marks.map((m) => map[m] ?? m))];
}

/** Facts keyed by line position move to the block id that owns the line. */
export function rewriteFacts(facts: Record<string, string>, session: SessionLike): Record<string, string> {
  const owner = sessionPlan(session).owner;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(facts)) {
    const id = /^\d+$/.test(key) ? owner[Number(key)] : key;
    if (id) out[id] = value;
  }
  return out;
}

function repsMid(reps: string): number {
  const m = /(\d+)(?:-(\d+))?/.exec(reps);
  if (!m) return 0;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  return Math.round((lo + hi) / 2);
}

function loadMid(load: string): number | null {
  const m = /(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?/.exec(load.replace(",", "."));
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  if (!a) return null;
  return Math.round(((a + b) / 2) * 10) / 10;
}

/** Totals for the checked blocks. A typed fact weight replaces the planned load. */
export function planTotalsFromBlocks(blocks: ProgramBlock[], checked: string[], facts: Record<string, string>) {
  let sets = 0;
  let volume = 0;
  let restSec = 0;
  for (const b of blocks) {
    if (!checked.includes(b.id)) continue;
    restSec += b.rest ?? 0;
    const typed = Number((facts[b.id] ?? "").replace(",", "."));
    const kg = typed > 0 ? typed : loadMid(b.load);
    const reps = repsMid(b.reps);
    const s = b.sets * (b.side ? 2 : 1);
    if (s > 0 && reps > 0 && kg != null) {
      sets += s;
      volume += s * reps * kg;
    }
  }
  return { sets, volume: Math.round(volume), restSec };
}
