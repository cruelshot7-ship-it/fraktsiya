import { isSlotPast } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { SectionLabel, Surface } from "@/components/app/bits";

/** After a long break: calm return, no automatic load restore. */
export function SoftReturnPanel() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const setTab = useStudio((s) => s.setTab);
  const client = activeClient({ clients, activeClientId });

  if (role !== "client" || !client) return null;

  const mine = bookings.filter((b) => b.clientId === client.id && !b.noShow);
  const upcoming = mine.filter((b) => !isSlotPast(b.date, b.time));
  if (upcoming.length) return null;

  const past = mine
    .filter((b) => isSlotPast(b.date, b.time))
    .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
  const last = past[0];
  if (!last) return null;

  const days = Math.floor(
    (Date.now() - Date.parse(`${last.date}T${last.time}:00`)) / (24 * 60 * 60 * 1000),
  );
  if (Number.isNaN(days) || days < 14) return null;

  return (
    <Surface glow="soft">
      <SectionLabel>Возвращение после перерыва</SectionLabel>
      <p className="mt-2 text-sm leading-relaxed">
        Последнее занятие было {days} дн. назад. Нагрузку не поднимаем автоматически — начните с
        удобного слота и обсудите план с тренером.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => setTab("schedule")}
        >
          Выбрать слот
        </button>
        <button
          type="button"
          className="pressable h-11 rounded-xl bg-secondary text-sm font-medium"
          onClick={() => setTab("program")}
        >
          Контекст плана
        </button>
      </div>
    </Surface>
  );
}
