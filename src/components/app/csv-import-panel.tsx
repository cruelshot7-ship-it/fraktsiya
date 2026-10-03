import { useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { parseCsvPreview, suggestColumnMap } from "@/lib/csv-import/preview";
import { rowsToClientDrafts } from "@/lib/csv-import/apply-local";
import { findDuplicates } from "@/lib/csv-import/duplicates";
import { SectionLabel, Surface } from "@/components/app/bits";

/** Trainer CSV → explicit confirm → local studio clients only (not Neon). */
export function CsvImportPanel() {
  const role = useStudio((s) => s.role);
  const showToast = useStudio((s) => s.showToast);
  const addClient = useStudio((s) => s.addClient);
  const clients = useStudio((s) => s.clients);
  const [preview, setPreview] = useState<ReturnType<typeof parseCsvPreview> | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (role !== "trainer") return null;

  function onFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const result = parseCsvPreview(text);
      setPreview(result);
      setMap(suggestColumnMap(result.headers));
      if (result.errors.length) {
        showToast(`Предпросмотр: ${result.errors[0]}`);
      } else {
        showToast(`Строк: ${result.rowCount}. Проверьте и подтвердите импорт.`);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function confirmImport() {
    if (!preview || busy) return;
    setBusy(true);
    try {
      const { drafts, skipped } = rowsToClientDrafts(preview.rows, map, 30);
      if (!drafts.length) {
        showToast("Нет строк с именем для импорта.");
        return;
      }
      const dups = findDuplicates(drafts, clients);
      const skipIdx = new Set(dups.map((d) => d.draftIndex));
      let ok = 0;
      let dupSkipped = 0;
      for (let i = 0; i < drafts.length; i++) {
        if (skipIdx.has(i)) {
          dupSkipped += 1;
          continue;
        }
        const d = drafts[i]!;
        const id = addClient({
          firstName: d.firstName,
          lastName: d.lastName,
          telegramUsername: d.telegramUsername,
          phone: d.phone,
        });
        if (id) ok += 1;
      }
      showToast(
        `Локально добавлено: ${ok}` +
          (skipped ? ` · пустых: ${skipped}` : "") +
          (dupSkipped ? ` · дубли: ${dupSkipped}` : "") +
          ". Neon не трогали.",
      );
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Surface>
      <SectionLabel>Импорт клиентов · CSV</SectionLabel>
      <p className="mt-2 text-tiny text-muted-foreground">
        Предпросмотр → подтверждение. Только локальный список клиентов, не production Neon.
      </p>
      <label className="pressable mt-3 flex h-11 cursor-pointer items-center justify-center rounded-xl bg-secondary text-sm font-medium">
        Выбрать CSV
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {preview ? (
        <div className="mt-3 space-y-2">
          {preview.errors.length ? (
            <ul className="text-tiny text-primary">
              {preview.errors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Колонки: {preview.headers.join(", ") || "—"} · строк {preview.rowCount}
          </p>
          {Object.keys(map).length ? (
            <p className="text-tiny text-muted-foreground">
              Сопоставление:{" "}
              {Object.entries(map)
                .map(([k, v]) => `${k}→${v}`)
                .join("; ")}
            </p>
          ) : null}
          <div className="max-h-40 overflow-auto rounded-lg bg-secondary/40 p-2 text-2xs">
            {preview.rows.slice(0, 8).map((row, i) => (
              <p key={i} className="truncate">
                {preview.headers.map((h) => row[h]).join(" · ")}
              </p>
            ))}
          </div>
          {(() => {
            const { drafts } = rowsToClientDrafts(preview.rows, map, 30);
            const dups = findDuplicates(drafts, clients);
            if (!dups.length) return null;
            return (
              <p className="text-tiny text-primary">
                Возможные дубликаты: {dups.slice(0, 5).map((d) => d.reason).join("; ")}
              </p>
            );
          })()}
          <button
            type="button"
            disabled={busy}
            className="pressable h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
            onClick={confirmImport}
          >
            {busy ? "Импорт…" : "Подтвердить · локальный список"}
          </button>
        </div>
      ) : null}
    </Surface>
  );
}
