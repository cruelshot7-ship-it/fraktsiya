import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Высота одной строки барабана, px. */
const ITEM_H = 44;
/** Сколько строк видно сразу (нечётное число: одна в центре подсвечена). */
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/**
 * Одна колонка-барабан: прокрутка с привязкой к строке (scroll-snap), как выбор времени в системных часах.
 * Значение — индекс в `items`. Выбор фиксируется, когда прокрутка остановилась; тап по строке тоже выбирает.
 */
export function WheelColumn({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: string[];
  value: number;
  onChange: (index: number) => void;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(value);
  const settle = useRef<number | undefined>(undefined);
  const userScrolling = useRef(false);

  // Значение пришло извне (открытие формы, выбор часов в соседней колонке): встать на него без рывка.
  useEffect(() => {
    const el = ref.current;
    if (!el || userScrolling.current) return;
    const target = value * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
    setActive(value);
  }, [value]);

  useEffect(() => () => window.clearTimeout(settle.current), []);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    userScrolling.current = true;
    const index = Math.min(items.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
    setActive(index);
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      userScrolling.current = false;
      if (index !== value) onChange(index);
    }, 140);
  }

  function pick(index: number) {
    const el = ref.current;
    if (el) el.scrollTo({ top: index * ITEM_H, behavior: "smooth" });
    setActive(index);
    if (index !== value) onChange(index);
  }

  return (
    <div className={cn("relative", className)} style={{ height: VISIBLE * ITEM_H }}>
      {/* полоса выбора по центру: под ней строка, которая сейчас выбрана */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-1 rounded-lg bg-secondary"
        style={{ top: PAD, height: ITEM_H }}
      />
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        onScroll={onScroll}
        className="relative h-full overflow-y-auto overscroll-contain"
        style={{
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          paddingTop: PAD,
          paddingBottom: PAD,
          touchAction: "pan-y",
        }}
      >
        {items.map((text, i) => (
          <button
            key={`${text}-${i}`}
            type="button"
            role="option"
            aria-selected={i === value}
            onClick={() => pick(i)}
            className={cn(
              "flex w-full items-center justify-center font-display text-xl font-semibold tabular-nums transition-colors",
              i === active ? "text-foreground" : "text-muted-foreground/60",
            )}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, h) => pad2(h));
/** Шаг 5 минут: покрывает и «:00», и «:30», и «:15». */
const MINUTES = Array.from({ length: 12 }, (_, i) => pad2(i * 5));
const PLACES = Array.from({ length: 12 }, (_, i) => String(i + 1));

/** Время «ЧЧ:ММ» колёсами часов и минут (шаг 5 минут). Минуты, не кратные 5, округляются к ближайшей. */
export function TimeWheel({ value, onChange }: { value: string; onChange: (hhmm: string) => void }) {
  const [h, m] = value.split(":").map((x) => Number(x));
  const hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 18;
  const minRaw = Number.isFinite(m) ? m : 0;
  const minute = Math.min(MINUTES.length - 1, Math.round(minRaw / 5));
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1">
      <WheelColumn
        label="Часы"
        items={HOURS}
        value={hour}
        onChange={(i) => onChange(`${HOURS[i]}:${MINUTES[minute]}`)}
      />
      <span className="font-display text-xl font-semibold text-muted-foreground" aria-hidden="true">:</span>
      <WheelColumn
        label="Минуты"
        items={MINUTES}
        value={minute}
        onChange={(i) => onChange(`${HOURS[hour]}:${MINUTES[i]}`)}
      />
    </div>
  );
}

/** Число мест (1–12) колесом. */
export function PlacesWheel({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const index = Math.min(PLACES.length - 1, Math.max(0, value - 1));
  return (
    <WheelColumn label="Мест" items={PLACES} value={index} onChange={(i) => onChange(i + 1)} />
  );
}
