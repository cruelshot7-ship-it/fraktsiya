import { useMemo, useState } from "react";
import { STUDIO, formatLongDate, isSlotPast } from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { requestJoin } from "@/lib/studio-sync";
import { getTelegramInitData } from "@/lib/telegram";
import { SectionLabel } from "@/components/app/bits";
import { BrandShaderHero } from "@/components/app/brand-shader-hero";
import { cn } from "@/lib/utils";

const GOALS = ["Похудеть", "Сила", "Форма"] as const;

/** Единственное предложение на входе: пробный час. Цены и пакеты здесь не показываем. */
const TRIAL_LABEL = "Пробный час";

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
  const [slotId, setSlotId] = useState("");
  const [goal, setGoal] = useState<(typeof GOALS)[number]>("Форма");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // the request sends the name, @username and the chosen time: the trainer sees them only after this consent
  const [agreed, setAgreed] = useState(false);

  const picked = openings.find((s) => s.id === slotId);
  const waiting = live && (sent || Boolean(pending));

  async function submit() {
    if (!picked) {
      showToast("Выберите время.");
      return;
    }
    const offer = [TRIAL_LABEL, picked.label, `Цель: ${goal}`].join("\n");
    if (!live) {
      setSent(true);
      showToast("Это показ. Заявка не ушла.");
      return;
    }
    setBusy(true);
    sendJoinRequest(offer, { slotId: picked.id, goal, pack: TRIAL_LABEL });
    const res = await requestJoin({
      data: {
        initData: getTelegramInitData(),
        offer,
        slotId: picked.id,
        goal,
        pack: TRIAL_LABEL,
        consentVersion: PRIVACY_VERSION,
      },
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
    <div className={cn("relative", !live && "fixed inset-0 z-40 overflow-y-auto bg-background")}>
      {step === "intro" ? <BrandShaderHero /> : null}
      <div className={cn("relative z-10 mx-auto flex w-full max-w-app flex-col", !live && "min-h-dvh px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-8")}>
        {!live ? (
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-tiny text-alert-text">Показ</p>
            <button type="button" className="text-sm text-muted-foreground" onClick={close}>
              Закрыть
            </button>
          </div>
        ) : null}

        {step === "intro" ? (
          <>
            <h1 className="font-display text-4xl leading-[0.95] tracking-wide text-foreground drop-shadow-sm">
              Один час.
              <br />
              Без обязательств.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Тренер покажет технику в зале и подскажет, какой формат подойдёт именно вам. Если захотите продолжить — подберём программу под вашу цель.
            </p>
            <p className="mt-2 text-tiny text-muted-foreground">
              {STUDIO.city}, {STUDIO.address}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-card px-2 py-3 text-center shadow-border">
                <p className="font-display text-2xl leading-none">60</p>
                <p className="mt-1.5 text-3xs leading-snug text-muted-foreground">минут в зале</p>
              </div>
              <div className="rounded-xl bg-card px-2 py-3 text-center shadow-border">
                <p className="font-display text-2xl leading-none">1</p>
                <p className="mt-1.5 text-3xs leading-snug text-muted-foreground">тренер</p>
              </div>
              <div className="rounded-xl bg-card px-2 py-3 text-center shadow-border">
                <p className="font-display text-2xl leading-none">{STUDIO.gym}</p>
                <p className="mt-1.5 text-3xs leading-snug text-muted-foreground">Лидская, 1</p>
              </div>
            </div>
            <p className="mt-4 text-tiny text-muted-foreground">Возьмите форму, воду и кроссовки.</p>
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
            <p className="mt-2 text-sm text-muted-foreground">{TRIAL_LABEL} · 60 минут</p>
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
                          option === goal ? "bg-ok text-ok-foreground" : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                  />
                  <span>
                    Согласен(на) на обработку имени, @username и времени для заявки, а также на передачу этих данных
                    сервисам вне Беларуси (хостинг, база данных, Telegram). Политика — в «Профиль» → «Политика конфиденциальности».
                  </span>
                </label>
                <button
                  type="button"
                  disabled={busy || !picked || !agreed}
                  className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                  onClick={() => void submit()}
                >
                  {busy ? "…" : "Отправить заявку"}
                </button>
                <p className="mt-3 text-tiny text-muted-foreground">
                  Заявка уходит тренеру: имя, @username и выбранное время. Как мы обращаемся с данными — в «Профиль» → «Политика конфиденциальности». Замеры и самочувствие собираются только с вашего отдельного согласия.
                </p>
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
