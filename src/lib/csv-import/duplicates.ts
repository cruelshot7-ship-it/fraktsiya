import type { LocalClientDraft } from "./apply-local";

type Existing = {
  firstName?: string;
  lastName?: string;
  telegramUsername?: string | null;
  phone?: string | null;
};

function normName(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function normPhone(s: string | null | undefined) {
  const d = (s ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `7${d.slice(1)}`;
  if (d.length === 10) return `7${d}`;
  return d;
}

function normUser(s: string | null | undefined) {
  return (s ?? "").replace(/^@/, "").trim().toLowerCase();
}

export function findDuplicates(
  drafts: LocalClientDraft[],
  existing: Existing[],
): { draftIndex: number; reason: string }[] {
  const hits: { draftIndex: number; reason: string }[] = [];
  drafts.forEach((d, i) => {
    const phone = normPhone(d.phone);
    const user = normUser(d.telegramUsername);
    const name = normName(`${d.firstName} ${d.lastName}`);
    for (const e of existing) {
      if (phone && phone.length >= 10 && normPhone(e.phone) === phone) {
        hits.push({ draftIndex: i, reason: `телефон ${d.phone}` });
        return;
      }
      if (user && normUser(e.telegramUsername) === user) {
        hits.push({ draftIndex: i, reason: `@${user}` });
        return;
      }
      if (name && normName(`${e.firstName ?? ""} ${e.lastName ?? ""}`) === name) {
        hits.push({ draftIndex: i, reason: `имя ${d.firstName} ${d.lastName}`.trim() });
        return;
      }
    }
  });
  return hits;
}
