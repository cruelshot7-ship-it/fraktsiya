import { useState } from "react";
import { SectionLabel, Surface } from "@/components/app/bits";
import { exportStudioFn } from "@/lib/studio-export";
import { getTelegramInitData } from "@/lib/telegram";
import { cn } from "@/lib/utils";

type Status = "idle" | "busy" | "saved" | "error";

/** Сохранение файла на устройство. В Telegram загрузка иногда блокируется: тогда помогает «Открыть в браузере». */
function saveFile(fileName: string, text: string): boolean {
  try {
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
  } catch {
    return false;
  }
}

/** Выгрузка копии базы для тренера. Файл не отправляется в чат и не хранится на сервере. */
export function BackupExportPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function exportCopy() {
    if (status === "busy") return;
    setStatus("busy");
    setMessage(null);
    try {
      const res = await exportStudioFn({ data: { initData: getTelegramInitData() } });
      if (!res.ok) {
        setStatus("error");
        setMessage(res.reason === "forbidden" ? "Выгрузка доступна только тренеру." : "Нет доступа.");
        return;
      }
      const saved = saveFile(res.fileName, res.json);
      setStatus(saved ? "saved" : "error");
      setMessage(
        saved
          ? "Файл сохранён на устройство. Если загрузка не началась, откройте приложение в браузере через меню ⋯."
          : "Не удалось сохранить файл. Откройте приложение в браузере через меню ⋯ и повторите.",
      );
    } catch {
      setStatus("error");
      setMessage("Нет связи. Попробуйте позже.");
    }
  }

  return (
    <Surface className="space-y-3">
      <SectionLabel>Копия базы</SectionLabel>
      <p className="break-words text-tiny text-muted-foreground">
        Файл выгружается на ваше устройство. Резервные копии состояния хранятся на сервере и в Telegram; их автоматическая очистка пока не настроена.
      </p>
      <button
        type="button"
        onClick={() => void exportCopy()}
        disabled={status === "busy"}
        className={cn("h-11 w-full rounded-lg bg-secondary text-sm font-medium", status === "busy" && "opacity-60")}
      >
        {status === "busy" ? "Готовлю файл…" : "Скачать копию базы"}
      </button>
      {message ? (
        <p className={cn("break-words text-sm", status === "error" ? "text-destructive" : "text-muted-foreground")}>{message}</p>
      ) : null}
    </Surface>
  );
}
