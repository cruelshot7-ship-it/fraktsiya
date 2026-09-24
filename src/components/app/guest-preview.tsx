import { useMemo, useState } from "react";
import { STUDIO, formatLongDate, isSlotPast } from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { requestJoin } from "@/lib/studio-sync";
import { getTelegramInitData } from "@/lib/telegram";
import { SectionLabel } from "@/components/app/bits";
import { cn } from "@/lib/utils";

const GOALS = ["Похудеть", "Сила", "Форма"] as const;

const OFFERS = [
  { id: "trial", title: "Пробная", price: "0", unit: "BYN", note: "час в зале" },
  { id: "8", title: "8 занятий", price: "200", unit: "BYN", note: "25 за тренировку" },
  { id: "12", title: "12 занятий", price: "265", unit: "BYN", note: "22 за тренировку" },
] as const;

export function OfferLanding({ live }: { live: boolean }) {
  const close = useStudio((s) => s.closeGuestPreview);
  const openNote = useStudio((s) => s.openNote);
  const showToast = useStudio((s) => s.showToast);
  const sendJoinRequest = useStudio((s) => s.sendJoinRequest);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const closed = useStudio((s) => s.closedSlotIds);
  const pending = useStudio((s) => s.joinRequests.find((r) => r.status === "pending"));

  const openings = useMemo(
    () =>
      slots
        .filter((s) => !closed.includes(s.id) && !isSlotPast(s.date, s.time) && slotTaken(s, bookings) < s.capacity)
        .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`))
        .slice(0, 6)
        .map((s) => ({ id: s.id, label: `${formatLongDate(s.date)} · ${s.time}` })),
    [slots, bookings, closed],
  );

  const [step, setStep] = useState<"intro" | "time">("intro");
  const [packId, setPackId] = useState<(typeof OFFERS)[number]["id"]>("trial");
  const [slotId, setSlotId] = useState("");
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("Форма");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const pack = OFFERS.find((o) => o.id === packId) ?? OFFERS[0];
  const picked = openings.find((s) => s.id === slotId);
  const waiting = live && (sent || Boolean(pending));

  async function submit() {
    if (!picked) {
      showToast("Выберите время.");
      return;
    }
    const offer = [`${pack.title} · ${pack.price} ${pack.unit}`, picked.label, `Цель: ${goal}`].join("\n");
    if (!live) {
      setSent(true);
      showToast("Это показ. Заявка не ушла.");
      return;
    }
    setBusy(true);
    sendJoinRequest(offer, { slotId: picked.id, goal, pack: `${pack.title} · ${pack.price} ${pack.unit}` });
    const res = await requestJoin({
      data: { initData: getTelegramInitData(), offer, slotId: picked.id, goal, pack: pack.title },
    }).catch(() => ({ ok: false }));
    setBusy(false);
    if (!res.ok) {
      showToast("Не отправилось. Напишите тренеру.");
      return;
    }
    setSent(true);
    showToast("Заявка ушла.");
  }

  if (waiting) {
    return (
      <div className={cn(!live && "fixed inset-0 z-40 overflow-y-auto bg-background")}>
        <div className={cn("mx-auto w-full max-w-app", !live && "min-h-dvh px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8")}>
          {!live ? (
            <button type="button" className="mb-3 text-sm text-muted-foreground" onClick={close}>
              Закрыть
            </button>
          ) : null}
          <div className="rounded-xl bg-card p-5 shadow-border glow-ok">
            <SectionLabel>Заявка ушла</SectionLabel>
            <p className="font-display mt-2 text-2xl leading-tight">Евгений напишет</p>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{pending?.message || "Ждём ответ тренера."}</p>
          </div>
        </div>
      </div>
    );
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

        {step === "intro" ? (
          <>
            <h1 className="font-display text-4xl leading-[0.95] tracking-wide">
              Первая
              <br />
              бесплатно
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {STUDIO.trainer}, {STUDIO.city}. Час в зале: техника и понятно, ваш ли это формат. Возьмите форму, воду и кроссовки.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {OFFERS.map((offer) => (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setPackId(offer.id)}
                  className={cn(
                    "pressable rounded-xl px-2 py-3 text-center shadow-border",
                    offer.id === pack.id ? "glow-ok bg-ok-dim" : "bg-card",
                  )}
                >
                  <p className="text-3xs tracking-wide text-muted-foreground uppercase">{offer.title}</p>
                  <p className="font-display mt-1 text-2xl leading-none">
                    {offer.price}
                    <span className="ml-0.5 text-xs">{offer.unit}</span>
                  </p>
                  <p className="mt-1.5 text-3xs leading-snug text-muted-foreground">{offer.note}</p>
                </button>
              ))}
            </div>
            <p className="mt-2 text-tiny text-muted-foreground">12 занятий выгоднее на 35 BYN.</p>
            <button
              type="button"
              className="pressable mt-6 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
              onClick={() => setStep("time")}
            >
              Выбрать время
            </button>
          </>
        ) : (
          <>
            <button type="button" className="self-start text-sm text-muted-foreground" onClick={() => setStep("intro")}>
              Назад
            </button>
            <h1 className="font-display mt-3 text-4xl leading-none tracking-wide">Время</h1>
            <p className="mt-2 text-sm text-muted-foreground">{pack.title} · {pack.price} {pack.unit}</p>
            {openings.length === 0 ? (
              <>
                <p className="mt-5 text-sm leading-relaxed text-muted-foreground">Свободных окон сейчас нет. Напишите тренеру — он откроет время.</p>
                <button
                  type="button"
                  className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
                  onClick={() => openNote()}
                >
                  Написать тренеру
                </button>
              </>
            ) : (
              <>
                <div className="mt-4 flex flex-col gap-2">
                  {openings.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSlotId(slot.id)}
                      className={cn(
                        "pressable rounded-xl px-4 py-3 text-left text-sm shadow-border",
                        slot.id === slotId ? "glow-ok bg-ok-dim" : "bg-card",
                      )}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                <div className="mt-5">
                  <SectionLabel>Цель</SectionLabel>
                  <div className="mt-2 flex gap-1.5">
                    {GOALS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGoal(option)}
                        className={cn(
                          "pressable h-10 flex-1 rounded-lg text-xs font-medium",
                          option === goal ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy || !picked}
                  className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                  onClick={() => void submit()}
                >
                  {busy ? "…" : "Отправить заявку"}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function GuestPreview() {
  return <OfferLanding live={false} />;
}
