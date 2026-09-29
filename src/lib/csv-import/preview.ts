/**
 * CSV import preview — no write until trainer confirms (Stage 2).
 */

export type CsvPreviewRow = Record<string, string>;

export type CsvPreviewResult = {
  headers: string[];
  rows: CsvPreviewRow[];
  errors: string[];
  rowCount: number;
};

export function parseCsvPreview(text: string, maxRows = 50): CsvPreviewResult {
  const errors: string[] = [];
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);

  if (!lines.length) {
    return { headers: [], rows: [], errors: ["Пустой файл"], rowCount: 0 };
  }

  const headers = splitCsvLine(lines[0]);
  if (headers.length < 2) {
    errors.push("Ожидается минимум 2 колонки в заголовке");
  }

  const rows: CsvPreviewRow[] = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => !c.trim())) continue;
    if (cells.length !== headers.length) {
      errors.push(`Строка ${i + 1}: колонок ${cells.length}, в заголовке ${headers.length}`);
    }
    const row: CsvPreviewRow = {};
    headers.forEach((h, idx) => {
      row[h || `col_${idx}`] = cells[idx] ?? "";
    });
    rows.push(row);
  }

  if (lines.length - 1 > maxRows) {
    errors.push(`Показаны первые ${maxRows} строк из ${lines.length - 1}`);
  }

  return { headers, rows, errors, rowCount: lines.length - 1 };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function suggestColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
  for (const h of headers) {
    const n = norm(h);
    if (/(имя|name|client|клиент)/.test(n)) map[h] = "firstName";
    else if (/(telegram|username|\btg\b)/.test(n)) map[h] = "telegram";
    else if (/(телефон|phone|^tel$)/.test(n)) map[h] = "phone";
    else if (/(заметк|note|comment)/.test(n)) map[h] = "note";
  }
  return map;
}
