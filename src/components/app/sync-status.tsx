import { useEffect, useState } from "react";
import { hasUnsyncedChanges } from "@/lib/studio-identity";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function SyncStatusChip({ className }: { className?: string }) {
  const toast = useStudio((s) => s.toast);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [dirty, setDirty] = useState(false);

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
    const tick = () => setDirty(hasUnsyncedChanges());
    tick();
    const id = window.setInterval(tick, 1200);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ruksha:dirty") tick();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  let label = "синк ок";
  let tone: "muted" | "alert" | "ok" = "ok";
  if (!online) {
    label = "офлайн · на устройстве";
    tone = "alert";
  } else if (dirty || toast) {
    label = toast ? "сохраняем…" : "в очереди на сервер";
    tone = "alert";
  } else {
    label = "сохранено";
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
      title="Очередь уходит в Neon при сети; при закрытии Mini App — принудительный flush"
    >
      {label}
    </p>
  );
}
