import { useMemo, useState } from "react";
import { STUDIO, WEEKDAY_TIMES, addDays, formatLongDate, isoDate, isSlotPast } from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { requestJoin } from "@/lib/studio-sync";
import { getTelegramInitData } from "@/lib/telegram";
import { SectionLabel } from "@/components/app/bits";
import { cn } from "@/lib/utils";

const GOALS = ["Похудеть", "Сила", "Форма"] as const;
const FREQ = ["2", "3", "4"] as const;
const LEVELS = ["Первый раз", "Был перерыв", "Тренируюсь"] as const;

const OFFERS = [
  { id: "trial", title: "Пробная", price: "0", unit: "BYN", note: "без пакета" },
  { id: "8", title: "8 занятий", price: "200", unit: "BYN", note: "25 за тренировку" },
  { id: "12", title: "12 занятий", price: "265", unit: "BYN", note: "22 за тренировку" },
] as const;

export function OfferLanding({ live }: { live: boolean }) {
  const close = useStudio((s) => s.closeGuestPreview);
  const showToast = useStudio((s) => s.showToast);
  const sendJoinRequest = useStudio((s) => s.sendJoinRequest);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closed = useStudio((s) => s.closedSlotIds);
  const pending = useStudio((s) => s.joinRequests.find((r) => r.status === "pending"));

  const openings = useMemo(() => {
    const liveSlots = slots
      .filter((s) => !closed.includes(s.id) && !isSlotPast(s.date, s.time) && slotTaken(s, bookings) < s.capacity)
      .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))
      .slice(0, 6)
      .map((s) => ({ id: s.id, label: `${formatLongDate(s.date)} · ${s.time}` }));
    if (liveSlots.length) return liveSlots;
    const now = new Date();
    const fallback: { id: string; label: string }[] = [];
    for (let i = 0; i < 12 && fallback.length < 4; i += 1) {
      const day = addDays(now, i);
      if (day.getDay() === 0 || day.getDay() === 6) continue;
      const time = WEEKDAY_TIMES[fallback.length % WEEKDAY_TIMES.length] ?? "19:00";
      const date = isoDate(day);
      fallback.push({ id: `${date}_${time}`, label: `${formatLongDate(date)} · ${time}` });
    }
    return fallback;
  }, [slots, bookings, closed]);

  const [packId, setPackId] = useState<(typeof OFFERS)[number]["id"]>("trial");
  const [slotId, setSlotId] = useState(openings[0]?.id ?? "");
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("Форма");
  const [freq, setFreq] = useState<(typeof FREQ)[number]>("3");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("Был перерыв");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const pack = OFFERS.find((o) => o.id === packId) ?? OFFERS[0];
  const picked = openings.find((s) => s.id === slotId) ?? openings[0];
  const waiting = live && (sent || Boolean(pending));

  async function submit() {
    if (!picked) {
      showToast("Выберите время.");
      return;
    }
    const offer = [
      `${pack.title} · ${pack.price} ${pack.unit}`,
      picked.label,
      `${goal} · ${freq} раза в неделю · ${level}`,
      "Оплату обсудим лично.",
    ].join("\n");
    if (!live) {
      setSent(true);
      showToast("Это показ. Заявка не ушла.");
      return;
    }
    setBusy(true);
    sendJoinRequest(offer);
    const res = await requestJoin({ data: { initData: getTelegramInitData(), offer } }).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) {
      showToast("Не отправилось. Напишите тренеру.");
      return;
    }
    setSent(true);
    showToast("Заявка у тренера.");
  }

  return (
    <div className={cn(!live && "fixed inset-0 z-40 overflow-y-auto bg-background")}>
      <div className={cn("mx-auto flex w-full max-w-app flex-col", !live && "min-h-dvh px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8")}>
        {!live ? (
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-tiny text-primary">Показ</p>
            <button type="button" className="text-sm text-muted-foreground" onClick={close}>
              Закрыть
            </button>
          </div>
        ) : null}
        <h1 className="font-display text-4xl leading-[0.95] tracking-wide">
          Первая
          <br />
          бесплатно
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {STUDIO.trainer}, {STUDIO.city}. Выберите пакет и окно. Деньги в приложении не списываются — как платить, решите с тренером.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {OFFERS.map((offer) => {
            const on = offer.id === pack.id;
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => setPackId(offer.id)}
                className={cn(
                  "pressable rounded-xl px-2 py-3 text-center shadow-border",
                  on ? "glow-ok bg-ok-dim" : "bg-card",
                )}
              >
                <p className="text-3xs tracking-wide text-muted-foreground uppercase">{offer.title}</p>
                <p className="font-display mt-1 text-2xl leading-none">
                  {offer.price}
                  <span className="ml-0.5 text-xs">{offer.unit}</span>
                </p>
                <p className="mt-1.5 text-3xs leading-snug text-muted-foreground">{offer.note}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-tiny text-muted-foreground">12 занятий выгоднее на 35 BYN, чем тот же объём по цене восьмёрки.</p>

        <div className="mt-6">
          <SectionLabel>Время</SectionLabel>
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

        {waiting && picked ? (
          <div className="mt-5 rounded-xl bg-card p-4 shadow-border glow-ok">
            <SectionLabel>{live ? "Заявка у тренера" : "Так придёт заявка"}</SectionLabel>
            <p className="mt-2 whitespace-pre-line text-sm">
              {pending?.message || `${pack.title} · ${pack.price} ${pack.unit}\n${picked.label}\n${goal} · ${freq} раза · ${level}`}
            </p>
            <p className="mt-3 text-tiny text-muted-foreground">
              {live ? "Оплату обсудите лично. Когда тренер примет — откроется зал." : "Показ. В бот это не уходит."}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={busy}
          className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
          onClick={() => void submit()}
        >
          {busy ? "…" : pack.id === "trial" ? "Записаться бесплатно" : `Заявка на ${pack.title.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

export function GuestPreview() {
  return <OfferLanding live={false} />;
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
