import { useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { parseCsvPreview, suggestColumnMap } from "@/lib/csv-import/preview";
import { rowsToClientDrafts } from "@/lib/csv-import/apply-local";
import { findDuplicates } from "@/lib/csv-import/duplicates";
import { getTelegramInitData } from "@/lib/telegram";
import { SectionLabel, Surface } from "@/components/app/bits";

/** Trainer CSV → confirm → local clients + Neon app_users dual-write. */
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

  async function confirmImport() {
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
      const created: {
        id: string;
        firstName: string;
        lastName: string;
        telegramUsername?: string;
        phone?: string;
      }[] = [];

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
        if (id) {
          ok += 1;
          created.push({
            id,
            firstName: d.firstName,
            lastName: d.lastName,
            telegramUsername: d.telegramUsername,
            phone: d.phone,
          });
        }
      }

      let neonNote = "";
      const initData = getTelegramInitData();
      if (created.length && initData) {
        try {
          const { importClientsFn } = await import("@/lib/csv-import/server");
          const res = await importClientsFn({ data: { initData, clients: created } });
          if (res.ok && res.durable) {
            neonNote = ` · Neon: ${res.upserted}`;
          } else if (res.ok && !res.durable) {
            neonNote = " · Neon offline";
          } else {
            neonNote = " · Neon: ошибка";
          }
        } catch {
          neonNote = " · Neon: сеть";
        }
      }

      showToast(
        `Добавлено: ${ok}` +
          (skipped ? ` · пустых: ${skipped}` : "") +
          (dupSkipped ? ` · дубли: ${dupSkipped}` : "") +
          neonNote,
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
        Предпросмотр → подтверждение. Локальный список + запись в Neon (app_users).
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
          <p className="text-tiny text-muted-foreground">
            Строк: {preview.rowCount} · колонок: {preview.headers.join(", ") || "—"}
          </p>
          <button
            type="button"
            className="pressable h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
            disabled={busy || Boolean(preview.errors.length)}
            onClick={() => void confirmImport()}
          >
            {busy ? "Импорт…" : "Подтвердить импорт"}
          </button>
          <button
            type="button"
            className="pressable h-10 w-full rounded-xl bg-secondary text-sm"
            onClick={() => setPreview(null)}
          >
            Отмена
          </button>
        </div>
      ) : null}
    </Surface>
  );
}
