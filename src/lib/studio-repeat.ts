import { addDays, isoDate, parseISODate, TRAINER_TG_ID, type Slot } from "../data/studio.ts";

function closedOwner(id: string) {
  const last = id.split("_").at(-1) ?? "";
  return /^\d{2}:\d{2}$/.test(last) ? "" : last;
}

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
    copies.push({ ...slot, id, date });
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

export function mapsUrl(address: string) {
  const query = address.trim();
  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
