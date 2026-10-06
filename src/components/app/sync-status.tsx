import { useEffect, useState } from "react";
import { hasUnsyncedChanges, lastCloudSyncAt } from "@/lib/studio-identity";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

function agoLabel(ts: number | null): string {
  if (!ts) return "";
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 20) return "только что";
  if (sec < 60) return `${sec} с назад`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  return "ранее";
}

/**
 * Честный статус: устройство vs сервер (dirty сбрасывается только после ok от pushStudio).
 */
export function SyncStatusChip({ className }: { className?: string }) {
  const toast = useStudio((s) => s.toast);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [dirty, setDirty] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setDirty(hasUnsyncedChanges());
      setSyncedAt(lastCloudSyncAt());
    };
    tick();
    const id = window.setInterval(tick, 1000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ruksha:dirty" || e.key === "ruksha:lastSyncAt") tick();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("ruksha-sync", tick as EventListener);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ruksha-sync", tick as EventListener);
    };
  }, []);

  let label = "на сервере";
  let tone: "muted" | "alert" | "ok" = "ok";
  if (!online) {
    label = "только на телефоне";
    tone = "alert";
  } else if (dirty || toast) {
    label = toast ? "отправляем на сервер…" : "ещё не на сервере";
    tone = "alert";
  } else {
    const ago = agoLabel(syncedAt);
    label = ago ? `на сервере · ${ago}` : "на сервере";
    tone = "muted";
  }

  return (
    <p
      className={cn(
        "text-2xs",
        tone === "alert" && "text-primary",
        tone === "ok" && "text-ok",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
      title={
        dirty
          ? "Изменения ещё в очереди. Уйдут в облако при сети; при закрытии приложения — принудительная отправка."
          : "Последняя успешная отправка на сервер подтверждена ответом API."
      }
    >
      {label}
    </p>
  );
}
