import type { CsvPreviewRow } from "./preview";

export type LocalClientDraft = {
  firstName: string;
  lastName: string;
  telegramUsername?: string;
  phone?: string;
};

/** Map CSV rows to addClient drafts. Caller decides where to write. */
export function rowsToClientDrafts(
  rows: CsvPreviewRow[],
  columnMap: Record<string, string>,
  max = 30,
): { drafts: LocalClientDraft[]; skipped: number } {
  const drafts: LocalClientDraft[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (drafts.length >= max) {
      skipped += 1;
      continue;
    }
    const values: Record<string, string> = {};
    for (const [header, field] of Object.entries(columnMap)) {
      values[field] = (row[header] ?? "").trim();
    }
    for (const [header, cell] of Object.entries(row)) {
      if (!columnMap[header] && !values.firstName) {
        if (/имя|name/i.test(header)) values.firstName = cell.trim();
      }
    }

    const firstName = values.firstName || values.name || "";
    if (!firstName) {
      skipped += 1;
      continue;
    }
    const lastName = values.lastName || "";
    if (!lastName && firstName.includes(" ")) {
      const parts = firstName.split(/\s+/);
      drafts.push({
        firstName: parts[0]!,
        lastName: parts.slice(1).join(" "),
        telegramUsername: values.telegram || undefined,
        phone: values.phone || undefined,
      });
    } else {
      drafts.push({
        firstName,
        lastName,
        telegramUsername: values.telegram || undefined,
        phone: values.phone || undefined,
      });
    }
  }

  return { drafts, skipped };
}
