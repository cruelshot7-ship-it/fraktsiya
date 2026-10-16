import { addDays, isoDate, parseISODate, TRAINER_TG_ID, type Slot } from "../data/studio.ts";

function closedOwner(id: string) {
  const last = id.split("_").at(-1) ?? "";
  return /^\d{2}:\d{2}$/.test(last) ? "" : last;
}

/** Слоты и закрытия текущей недели (weekStart..+7), принадлежащие ownerId. */
export function weekSourceCounts(
  extra: Slot[],
  closed: string[],
  weekStart: string,
  ownerId = String(TRAINER_TG_ID),
): { extra: number; closed: number } {
  const end = isoDate(addDays(parseISODate(weekStart), 7));
  const me = ownerId || String(TRAINER_TG_ID);
  let extraN = 0;
  for (const slot of extra) {
    if (slot.date < weekStart || slot.date >= end) continue;
    if (slot.ownerId && slot.ownerId !== me) continue;
    extraN += 1;
  }
  let closedN = 0;
  for (const id of closed) {
    const date = id.slice(0, 10);
    if (date < weekStart || date >= end) continue;
    const who = closedOwner(id);
    if (who ? who !== me : me !== String(TRAINER_TG_ID)) continue;
    closedN += 1;
  }
  return { extra: extraN, closed: closedN };
}

/** Копия сетки на +7 дней. Записи клиентов не трогает. seeded всегда 0. */
export function repeatWeekSlots(extra: Slot[], closed: string[], weekStart: string, ownerId = String(TRAINER_TG_ID)) {
  const end = isoDate(addDays(parseISODate(weekStart), 7));
  const existing = new Set(extra.map((slot) => slot.id));
  const copies: Slot[] = [];
  const me = ownerId || String(TRAINER_TG_ID);
  for (const slot of extra) {
    if (slot.date < weekStart || slot.date >= end) continue;
    if (slot.ownerId && slot.ownerId !== me) continue;
    const date = isoDate(addDays(parseISODate(slot.date), 7));
    const id = slot.id.replace(slot.date, date);
    if (existing.has(id)) continue;
    copies.push({ ...slot, id, date, seeded: 0 });
  }
  const closedCopies: string[] = [];
  for (const id of closed) {
    const date = id.slice(0, 10);
    if (date < weekStart || date >= end) continue;
    const who = closedOwner(id);
    if (who ? who !== me : me !== String(TRAINER_TG_ID)) continue;
    const nextId = id.replace(date, isoDate(addDays(parseISODate(date), 7)));
    if (closed.includes(nextId) || closedCopies.includes(nextId)) continue;
    closedCopies.push(nextId);
  }
  return { extra: copies, closed: closedCopies };
}
