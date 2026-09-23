import { useMemo, useState } from "react";
import { STUDIO, WEEKDAY_TIMES, addDays, formatLongDate, isoDate, isSlotPast } from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { SectionLabel } from "@/components/app/bits";
import { cn } from "@/lib/utils";

const GOALS = ["Похудеть", "Сила", "Форма"] as const;
const FREQ = ["2", "3", "4"] as const;
const LEVELS = ["Первый раз", "Был перерыв", "Тренируюсь"] as const;

const OFFERS = [
  { id: "trial", title: "Пробная", note: "знакомство и зал" },
  { id: "8", title: "8 занятий", note: "пакет на месяц" },
  { id: "12", title: "12 занятий", note: "если ходишь стабильно" },
];

export function GuestPreview() {
  const close = useStudio((s) => s.closeGuestPreview);
  const showToast = useStudio((s) => s.showToast);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closed = useStudio((s) => s.closedSlotIds);

  const openings = useMemo(() => {
    const live = slots
      .filter((s) => !closed.includes(s.id) && !isSlotPast(s.date, s.time) && slotTaken(s, bookings) < s.capacity)
      .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))
      .slice(0, 3)
      .map((s) => ({ id: s.id, label: `${formatLongDate(s.date)} · ${s.time}` }));
    if (live.length) return live;
    const now = new Date();
    const fallback: { id: string; label: string }[] = [];
    for (let i = 0; i < 10 && fallback.length < 3; i += 1) {
      const day = addDays(now, i);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const time = WEEKDAY_TIMES[fallback.length] ?? "19:00";
      const date = isoDate(day);
      fallback.push({ id: `${date}_${time}`, label: `${formatLongDate(date)} · ${time}` });
    }
    return fallback;
  }, [slots, bookings, closed]);

  const [slotId, setSlotId] = useState(openings[0]?.id ?? "");
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("Форма");
  const [freq, setFreq] = useState<(typeof FREQ)[number]>("3");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Был перерыв");
  const [sent, setSent] = useState(false);

  const picked = openings.find((s) => s.id === slotId) ?? openings[0];

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-tiny text-primary">Демо · клиенты это не видят</p>
          <button type="button" className="text-sm text-muted-foreground" onClick={close}>
            Закрыть
          </button>
        </div>
        <h1 className="font-display mt-3 text-4xl leading-none tracking-wide">Пробная</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {STUDIO.trainer}, {STUDIO.city}. Зал, программа и питание — после первой встречи. Сейчас только запись на окно.
        </p>

        <div className="mt-5">
          <SectionLabel>Как можно зайти</SectionLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {OFFERS.map((offer) => (
              <div key={offer.id} className="rounded-xl bg-card px-2 py-3 text-center shadow-border">
                <p className="font-display text-sm leading-tight">{offer.title}</p>
                <p className="mt-1 text-3xs text-muted-foreground">{offer.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-3xs text-muted-foreground">Цены не стоят — впишешь свои, когда скажешь.</p>
        </div>

        <div className="mt-5">
          <SectionLabel>Свободные окна</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            {openings.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSlotId(slot.id)}
                className={cn(
                  "pressable rounded-xl px-4 py-3 text-left text-sm shadow-border",
                  slot.id === picked?.id ? "glow-ok bg-ok-dim" : "bg-card",
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <Choice label="Цель" options={GOALS} value={goal} onChange={setGoal} />
          <Choice label="Раз в неделю" options={FREQ} value={freq} onChange={setFreq} />
          <Choice label="Опыт" options={LEVELS} value={level} onChange={setLevel} />
        </div>

        {sent && picked ? (
          <div className="mt-5 rounded-xl bg-card p-4 shadow-border glow-ok">
            <SectionLabel>Так придёт заявка</SectionLabel>
            <p className="mt-2 text-sm">Пробная · {picked.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {goal} · {freq} раза в неделю · {level}
            </p>
            <p className="mt-3 text-tiny text-muted-foreground">Никому не отправлено. Это только показ.</p>
          </div>
        ) : null}

        <button
          type="button"
          className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            setSent(true);
            showToast("Демо. Заявка никуда не ушла.");
          }}
        >
          Хочу пробную
        </button>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 flex gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              "pressable h-10 flex-1 rounded-lg text-xs font-medium",
              option === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
