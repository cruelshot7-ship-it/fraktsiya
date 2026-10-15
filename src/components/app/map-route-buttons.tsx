import { mapsAppLinks } from "@/lib/maps-link";
import { openTelegramUrl } from "@/lib/telegram";
import { cn } from "@/lib/utils";

/** Кнопки «Маршрут» в выбранное приложение карт. Пусто, если адреса нет. */
export function MapRouteButtons({ address, variant = "secondary" }: { address: string; variant?: "primary" | "secondary" }) {
  const links = mapsAppLinks(address);
  if (links.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {links.map((app) => (
        <a
          key={app.label}
          href={app.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            // внутри Telegram ссылка открывается через openLink, без окна «Открыть ссылку?» у в-app браузера
            e.preventDefault();
            openTelegramUrl(app.url);
          }}
          className={cn(
            "pressable flex h-11 items-center justify-center rounded-lg text-sm font-medium",
            variant === "primary" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
          )}
        >
          {app.label}
        </a>
      ))}
    </div>
  );
}
