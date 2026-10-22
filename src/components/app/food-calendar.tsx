import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, isoDate, parseISODate } from "@/data/studio";
import { cn } from "@/lib/utils";

const MONTHS_NOM = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

/**
 * Календарь дня для дневника питания. Выбирается любой день (прошлый и будущий).
 * marks — дни, где уже есть записи еды: под числом точка.
 */
export function FoodCalendar({
  value,
  today,
  marks,
  onChange,
}: {
  /** выбранный день, ISO yyyy-mm-dd */
  value: string;
  today: string;
  marks: Set<string>;
  onChange: (iso: string) => void;
}) {
  const [view, setView] = useState(() => {
    const d = parseISODate(value);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = view.getFullYear();
  const month = view.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    setView(new Date(year, month + delta, 1));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          onClick={() => shift(-1)}
          className="pressable grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="font-display text-base">
          {MONTHS_NOM[month]} {year}
        </p>
        <button
          type="button"
          aria-label="Следующий месяц"
          onClick={() => shift(1)}
          className="pressable grid size-11 place-items-center rounded-xl bg-secondary text-muted-foreground"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-2xs text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const iso = isoDate(new Date(year, month, day));
          const selected = iso === value;
          const isToday = iso === today;
          const marked = marks.has(iso);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange(iso)}
              aria-pressed={selected}
              aria-label={`${day} ${MONTHS_NOM[month].toLowerCase()}${marked ? ", есть записи" : ""}`}
              className={cn(
                "pressable relative flex h-11 flex-col items-center justify-center rounded-xl text-sm tabular-nums",
                selected ? "bg-ok font-medium text-ok-foreground" : "bg-secondary/60 text-foreground",
                isToday && !selected && "ring-1 ring-ok/60",
              )}
            >
              {day}
              {marked ? (
                <span
                  aria-hidden
                  className={cn("absolute bottom-1 size-1 rounded-full", selected ? "bg-ok-foreground" : "bg-ok")}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          onChange(today);
          setView(new Date(parseISODate(today).getFullYear(), parseISODate(today).getMonth(), 1));
        }}
        className="pressable h-9 self-center rounded-full px-4 text-tiny text-muted-foreground"
      >
        Сегодня
      </button>
    </div>
  );
}

/** Сдвиг ISO-даты на n дней (для «предыдущего дня»). */
export function shiftIso(iso: string, n: number) {
  return isoDate(addDays(parseISODate(iso), n));
}
