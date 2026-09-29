import { useStudio } from "@/lib/studio-store";
import { openCalendarEvent } from "@/lib/calendar-ics";
import { openMapsRoute } from "@/lib/maps-link";
import { SectionLabel, Surface } from "@/components/app/bits";

type Props = {
  bookingId: string;
  locationText?: string | null;
  onlineUrl?: string | null;
};

export function SessionExtras({ bookingId, locationText, onlineUrl }: Props) {
  const bookings = useStudio((s) => s.bookings);
  const showToast = useStudio((s) => s.showToast);
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) return null;

  const place = locationText?.trim() || null;
  const online = onlineUrl?.trim() || null;

  const event = {
    id: booking.id,
    title: "Тренировка · Ruksha",
    description: "Запись через Ruksha Discipline",
    date: booking.date,
    time: booking.time,
    durationMin: booking.duration || 60,
    timezone: "Europe/Minsk" as const,
    location: place || undefined,
    url: online || undefined,
  };

  function addToCalendar() {
    const how = openCalendarEvent(event);
    showToast(how === "google" ? "Открываем Google Календарь…" : "Файл календаря подготовлен.");
  }

  return (
    <Surface>
      <SectionLabel>Календарь и место</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          className="pressable h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={addToCalendar}
        >
          В Google Календарь
        </button>
        <button
          type="button"
          className="pressable h-11 w-full rounded-xl bg-secondary text-sm font-medium"
          onClick={() => {
            openCalendarEvent(event);
            showToast("Если окно не открылось — разрешите всплывающие окна Telegram.");
          }}
        >
          Ещё раз · календарь
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
            className="pressable flex h-11 w-full items-center justify-center rounded-xl bg-secondary text-sm font-medium"
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
