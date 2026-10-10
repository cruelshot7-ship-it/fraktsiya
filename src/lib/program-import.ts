/**
 * Program import from the trainer's Telegram chat.
 *
 * The trainer sends a message:
 *   /program Иванов
 *   День A
 *   Жим лежа
 *   4×8
 *   80 кг
 *   Отдых 90 секунд
 *   День B
 *   ...
 *
 * The first line names the client (a name or @handle). Lines after it are the program:
 * a "День …" line starts a day, a text line starts an exercise, sets/load/rest attach to it
 * (the same reading as the trainer's editor, see program-blocks). Pure, no imports
 * beyond program-blocks, so it runs under node --test.
 */
import { blocksFromItems, newBlockId, withBlocks, type ProgramBlock } from "@/lib/program-blocks";

export const MAX_DAYS = 7;
export const MAX_LINES = 300;
export const MAX_LINE = 120;

// "/program!" replaces a client's existing days; without "!" the bot refuses to overwrite them.
const COMMAND = /^\/(?:program|программа)(!?)(?:@\w+)?(?:[ \t]+([^\n]*))?(?:\n([\s\S]*))?$/i;
const DAY = /^(день|day)\s+\S+/i;

export type ImportCommand = { ok: true; query: string; body: string; force: boolean } | { ok: false; error: string };

/** null when the message is not a /program command at all. */
export function parseImportCommand(text: string): ImportCommand | null {
  const m = COMMAND.exec(text.trim());
  if (!m) return null;
  const force = m[1] === "!";
  const query = (m[2] ?? "").trim();
  const body = (m[3] ?? "").trim();
  if (!query) return { ok: false, error: "Укажите клиента: /program Имя, затем строки программы с новой строки." };
  if (!body) return { ok: false, error: `Программа для «${query}» пустая. Добавьте упражнения с новой строки.` };
  return { ok: true, query, body, force };
}

export type DayText = { name: string; lines: string[] };

/** Splits the body into days. Without "День …" lines the whole body is one day. */
export function splitDays(body: string): { ok: true; days: DayText[] } | { ok: false; error: string } {
  const days: DayText[] = [];
  let cur: DayText | null = null;
  let total = 0;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim().slice(0, MAX_LINE);
    if (!line) continue;
    total += 1;
    if (total > MAX_LINES) return { ok: false, error: `Слишком длинная программа: больше ${MAX_LINES} строк.` };
    if (DAY.test(line)) {
      cur = { name: line, lines: [] };
      days.push(cur);
      continue;
    }
    if (!cur) {
      cur = { name: "", lines: [] };
      days.push(cur);
    }
    cur.lines.push(line);
  }
  if (days.length > MAX_DAYS) return { ok: false, error: `Больше ${MAX_DAYS} дней в одной программе не записываю.` };
  const empty = days.find((d) => d.lines.length === 0);
  if (empty) return { ok: false, error: `В «${empty.name}» нет упражнений.` };
  if (!days.length) return { ok: false, error: "В сообщении нет строк программы." };
  return { ok: true, days: days.map((d, i) => ({ ...d, name: d.name || `День ${String.fromCharCode(65 + i)}` })) };
}

export type BuiltSession = { id: string; name: string; focus: string; items: string[]; blocks: ProgramBlock[] };

/**
 * Builds sessions from days. Blocks get fresh ids (the parser numbers them per list, which
 * would collide across days). A line that looks like a number with no exercise name in front
 * is reported, because it usually means the name line is missing.
 */
export function buildSessions(days: DayText[], now: number = Date.now()) {
  const warnings: string[] = [];
  const sessions: BuiltSession[] = days.map((day, i) => {
    const blocks = blocksFromItems(day.lines).map((b) => ({ ...b, id: newBlockId() }));
    for (const b of blocks) {
      if (/^\d/.test(b.exercise)) warnings.push(`«${b.exercise}» без названия упражнения — проверьте строку`);
    }
    const shell: BuiltSession = { id: `imp_${now.toString(36)}_${i}`, name: day.name, focus: "", items: [], blocks: [] };
    return withBlocks(shell, blocks);
  });
  return { sessions, warnings };
}

export type ClientRef = { id: string; firstName: string; lastName: string; telegramUsername?: string | null };

/** Matches by @handle or by name words (word prefixes). An exact full-name match wins. */
export function findClients<T extends ClientRef>(clients: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (q.startsWith("@")) {
    const handle = q.slice(1);
    return clients.filter((c) => (c.telegramUsername ?? "").replace(/^@/, "").toLowerCase() === handle);
  }
  const full = (c: ClientRef) => `${c.firstName} ${c.lastName}`.trim().toLowerCase().replace(/\s+/g, " ");
  const exact = clients.filter((c) => full(c) === q.replace(/\s+/g, " "));
  if (exact.length) return exact;
  const words = q.split(/\s+/).filter(Boolean);
  // each query word takes its own name part, so "Иванов Иван" does not match "Мария Иванова" by one part
  return clients.filter((c) => {
    const parts = full(c).split(" ");
    const used = new Set<number>();
    return words.every((w) => {
      const at = parts.findIndex((p, k) => !used.has(k) && p.startsWith(w));
      if (at < 0) return false;
      used.add(at);
      return true;
    });
  });
}

/**
 * Sessions to store for a client. A program the bot imported after the trainer's copy was
 * read is not overwritten by that older copy: the newer stamp wins. The trainer's own edits
 * made after a fresh read carry the stamp and go through.
 */
export function programFor<S>(
  old: { sessions: S; programAt?: string | null } | undefined,
  incoming: { sessions: S; programAt?: string | null },
): { sessions: S; programAt: string | null } {
  const stamp = old?.programAt ?? null;
  if (old && stamp && (incoming.programAt ?? "") < stamp) return { sessions: old.sessions, programAt: stamp };
  return { sessions: incoming.sessions, programAt: incoming.programAt ?? stamp };
}

/** First line of the force-reply prompt the bot sends after «Добавить программу». */
export const PROGRAM_PROMPT = "Пришлите программу";

/** The example the trainer copies: it must parse (see program-import.test.ts). */
export const PROGRAM_EXAMPLE = [
  "/program Елена",
  "День A",
  "Жим лежа",
  "4×8",
  "80 кг",
  "Отдых 90 секунд",
  "Подъём гантелей",
  "3×12 на каждую руку",
  "10 кг",
  "День B",
  "Приседания",
  "5×5",
  "100 кг",
  "Отдых 120 секунд",
].join("\n");

/** The text under the trainer's cabinet block: how to write a program, line by line. */
export function trainerCabinetText(): string {
  return [
    "Кабинет тренера.",
    "",
    "Добавить программу: нажмите «Добавить программу» под этим сообщением или пришлите её в чат.",
    "",
    "Как написать, строка за строкой:",
    "1. Первая строка — /program и имя клиента, как в карточке (или @ник).",
    "2. «День A», «День B» — заголовок дня. Без заголовков всё попадёт в один день.",
    "3. Упражнение — отдельной строкой: Жим лежа",
    "4. Подходы×повторения — следующей строкой: 4×8 (или 4x8, диапазон 10-12).",
    "5. Вес — отдельной строкой: 80 кг (или 10-12 кг).",
    "6. Отдых — отдельной строкой: Отдых 90 секунд.",
    "",
    "Строки 4–6 относятся к упражнению над ними. Каждое упражнение — отдельным блоком, как в примере.",
    "После кнопки «Добавить программу» пишите то же самое без /program: первая строка — имя клиента.",
    "Если у клиента уже есть программа, бот попросит «/program!» вместо «/program» — тогда старая заменится.",
    "",
    "Пример:",
    PROGRAM_EXAMPLE,
  ].join("\n");
}

/** A reply to the prompt becomes a /program command, unless the trainer already typed one. */
export function programCommandFromReply(text: string): string {
  const t = text.trim();
  return COMMAND.test(t) ? t : `/program ${t}`;
}
