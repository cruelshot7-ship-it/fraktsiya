import { useEffect, useState } from "react";
import { useStudio } from "@/lib/studio-store";

export function SyncStatusChip() {
  const toast = useStudio((s) => s.toast);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

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

  const label = !online
    ? "офлайн · черновик на устройстве"
    : toast
      ? "сохраняем…"
      : "сохранено на устройстве";

  return (
    <p
      className="text-2xs text-muted-foreground"
      title="Полная синхронизация с Neon — по dual-write, когда сервер доступен"
    >
      {label}
    </p>
  );
}
