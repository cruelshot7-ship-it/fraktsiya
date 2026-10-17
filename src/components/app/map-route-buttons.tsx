import { useMemo } from "react";
import { STUDIO_VENUE } from "@/data/studio";
import { mapPlatform, routeUrl } from "@/lib/maps-link";
import { openTelegramUrl } from "@/lib/telegram";
import { cn } from "@/lib/utils";

/** Кнопка «Маршрут»: открывает карты, подходящие устройству. Пусто, если адреса нет. */
export function MapRouteButtons({ address, variant = "secondary" }: { address: string; variant?: "primary" | "secondary" }) {
  const url = useMemo(
    () => routeUrl(address, mapPlatform(typeof navigator !== "undefined" ? navigator.userAgent : ""), STUDIO_VENUE),
    [address],
  );
  if (!url) return null;
  return (
    <div className="mt-3">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => {
          // внутри Telegram ссылка открывается через openLink, без окна «Открыть ссылку?» у в-app браузера
          e.preventDefault();
          openTelegramUrl(url);
        }}
        className={cn(
          "pressable flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium",
          variant === "primary" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
        )}
      >
        Маршрут
      </a>
    </div>
  );
}
