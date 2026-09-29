import { useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { parseCsvPreview, suggestColumnMap } from "@/lib/csv-import/preview";
import { SectionLabel, Surface } from "@/components/app/bits";

/** Trainer CSV preview only — no DB write until explicit confirm. */
export function CsvImportPanel() {
  const role = useStudio((s) => s.role);
  const showToast = useStudio((s) => s.showToast);
  const [preview, setPreview] = useState<ReturnType<typeof parseCsvPreview> | null>(null);
  const [map, setMap] = useState<Record<string, string>>({});

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
        showToast(`Строк: ${result.rowCount}. Импорт в базу ещё не включён.`);
      }
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <Surface>
      <SectionLabel>Импорт клиентов · CSV</SectionLabel>
      <p className="mt-2 text-tiny text-muted-foreground">
        Предпросмотр и сопоставление колонок. Запись в базу — только после подтверждения (скоро).
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
          <button
            type="button"
            className="pressable h-11 w-full rounded-xl bg-secondary text-sm text-muted-foreground"
            onClick={() => showToast("Импорт в базу пока отключён — только предпросмотр.")}
          >
            Подтвердить импорт (скоро)
          </button>
        </div>
      ) : null}
    </Surface>
  );
}
