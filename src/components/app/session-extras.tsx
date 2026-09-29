import { bookingIcs, downloadIcs } from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import { openMapsRoute } from "@/lib/maps-link";
import { SectionLabel, Surface } from "@/components/app/bits";

type Props = {
  bookingId: string;
  locationText?: string | null;
  onlineUrl?: string | null;
};

/** Calendar (.ics) + route / online link for a confirmed booking. */
export function SessionExtras({ bookingId, locationText, onlineUrl }: Props) {
  const bookings = useStudio((s) => s.bookings);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const place = locationText?.trim() || null;
  const online = onlineUrl?.trim() || null;

  return (
    <Surface>
      <SectionLabel>Календарь и место</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="pressable h-11 w-full rounded-xl bg-secondary text-sm font-medium"
          onClick={() => downloadIcs(`ruksha-${booking.date}-${booking.time}.ics`, bookingIcs(booking))}
        >
          Добавить в календарь (.ics)
        </button>
        {place ? (
          <button
            type="button"
            className="pressable h-11 w-full rounded-xl bg-secondary text-sm font-medium"
            onClick={() => openMapsRoute(place)}
          >
            Маршрут · {place.length > 28 ? `${place.slice(0, 28)}…` : place}
          </button>
        ) : null}
        {online ? (
          <a
            href={online}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          >
            Онлайн-ссылка
          </a>
        ) : null}
        {!place && !online ? (
          <p className="text-tiny text-muted-foreground">
            Адрес или ссылка появятся, когда тренер укажет их у слота.
          </p>
        ) : null}
      </div>
    </Surface>
  );
}
