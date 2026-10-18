import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { BottomSheet, inputClass } from "@/components/app/bits";

/** Высота одной строки барабана, px. */
const ITEM_H = 44;
/** Сколько строк видно сразу (нечётное число: одна в центре подсвечена). */
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

/** Как в iOS: выбранная строка яркая, соседние тают и уменьшаются по мере удаления от центра. */
function falloff(dist: number): { opacity: number; scale: number } {
  if (dist === 0) return { opacity: 1, scale: 1 };
  if (dist === 1) return { opacity: 0.5, scale: 0.92 };
  if (dist === 2) return { opacity: 0.25, scale: 0.85 };
  return { opacity: 0.1, scale: 0.8 };
}

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
          // затухание к краям барабана, как у системного выбора
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 36%, #000 64%, transparent 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0, #000 36%, #000 64%, transparent 100%)",
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
              "flex w-full items-center justify-center font-display text-xl font-semibold tabular-nums transition-[opacity,transform] duration-150",
              i === active ? "text-foreground" : "text-muted-foreground",
            )}
            style={{
              height: ITEM_H,
              scrollSnapAlign: "center",
              opacity: falloff(Math.abs(i - active)).opacity,
              transform: `scale(${falloff(Math.abs(i - active)).scale})`,
            }}
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

/* ---- поле-барабан: кнопка вместо текстового ввода, по нажатию — шторка с колёсами ---- */

const parseNum = (raw: string): number | null => {
  const t = raw.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export type WheelFieldProps = {
  /** заголовок шторки и подпись для доступности */
  label: string;
  /** значение строкой, как хранит экран; "" — не заполнено */
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  /** int — целые (шаг `step`); dec — дробные с шагом 0.1 (целая часть от min до max) */
  kind?: "int" | "dec";
  min?: number;
  max?: number;
  step?: number;
  /** показать «Очистить»: поле можно оставить пустым */
  allowEmpty?: boolean;
  /** с чего начинать барабан, если поле пустое */
  start?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export function WheelField({
  label,
  value,
  onChange,
  unit,
  kind = "int",
  min = 0,
  max = 100,
  step = 1,
  allowEmpty = false,
  start,
  placeholder,
  className,
  disabled = false,
}: WheelFieldProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  /** пользователь уже крутил колёса в этой шторке; иначе «Готово» не меняет значение */
  const [touched, setTouched] = useState(false);

  const intOptions = Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, i) => min + i * step);
  const intLabels = intOptions.map((n) => String(n));
  const FRACS = Array.from({ length: 10 }, (_, i) => String(i));

  const fallback = start ?? min;
  /** индекс в шкале целых; для dec — целая часть */
  function intIndexOf(text: string): number {
    const n = parseNum(text);
    const base = n ?? fallback;
    const whole = kind === "dec" ? Math.floor(base) : base;
    let best = 0;
    for (let i = 1; i < intOptions.length; i += 1) {
      if (Math.abs(intOptions[i] - whole) < Math.abs(intOptions[best] - whole)) best = i;
    }
    return clamp(best, 0, intOptions.length - 1);
  }
  function fracIndexOf(text: string): number {
    const n = parseNum(text);
    if (n == null) return 0;
    return clamp(Math.round((n - Math.floor(n)) * 10), 0, 9) % 10;
  }
  // Что сейчас стоит на колёсах: значение поля, если не крутили, иначе выбранное.
  const shownDraft = touched ? draft : value;
  const intIdx = intIndexOf(shownDraft);
  const fracIdx = fracIndexOf(shownDraft);

  function compose(i: number, f: number): string {
    if (kind === "int") return String(intOptions[i]);
    return f ? `${intOptions[i]}.${f}` : String(intOptions[i]);
  }

  function pickInt(i: number) {
    setDraft(compose(i, fracIdx));
    setTouched(true);
  }
  function pickFrac(f: number) {
    setDraft(compose(intIdx, f));
    setTouched(true);
  }

  function openSheet() {
    setDraft(value);
    setTouched(false);
    setOpen(true);
  }
  /** «Готово» сохраняет то, что показано на шторке: если колёса не крутили, значение не меняется */
  function done() {
    onChange(touched ? draft : value);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={openSheet}
        className={cn(inputClass, "flex items-center justify-between text-left tabular-nums disabled:opacity-40", className)}
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || placeholder || "—"}</span>
        {unit && value ? <span className="ml-2 shrink-0 text-2xs text-muted-foreground">{unit}</span> : null}
      </button>
      {open ? createPortal(
        // В body, а не внутри родительской шторки: родитель с анимацией и overflow-hidden иначе перекрывает или прячет эту шторку.
        <BottomSheet compact onClose={() => setOpen(false)}>
          <div className="flex flex-col px-5 pt-3 pb-4">
            <p className="text-2xs text-muted-foreground">{label}</p>
            <p className="font-display text-3xl tabular-nums" aria-live="polite">
              {shownDraft !== "" ? (unit ? `${shownDraft} ${unit}` : shownDraft) : "—"}
            </p>
            {!touched && value === "" ? (
              <p className="text-tiny text-muted-foreground">Прокрутите колёса, чтобы выбрать значение. Без этого поле останется пустым.</p>
            ) : null}
            <div className="mt-3 flex items-center justify-center gap-1">
              <WheelColumn
                label={label}
                items={intLabels}
                value={intIdx}
                onChange={pickInt}
                className="w-24"
              />
              {kind === "dec" ? (
                <>
                  <span className="font-display text-2xl text-muted-foreground" aria-hidden="true">,</span>
                  <WheelColumn
                    label={`${label}, десятые`}
                    items={FRACS}
                    value={fracIdx}
                    onChange={pickFrac}
                    className="w-16"
                  />
                </>
              ) : null}
            </div>
            <div className={cn("mt-4 grid gap-2", allowEmpty ? "grid-cols-3" : "grid-cols-2")}>
              <button type="button" className="h-11 rounded-lg bg-secondary text-sm" onClick={() => setOpen(false)}>
                Отмена
              </button>
              {allowEmpty ? (
                <button type="button" className="h-11 rounded-lg bg-secondary text-sm text-muted-foreground" onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}>
                  Очистить
                </button>
              ) : null}
              <button type="button" className="pressable h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground" onClick={done}>
                Готово
              </button>
            </div>
          </div>
        </BottomSheet>,
        document.body,
      ) : null}
    </>
  );
}
