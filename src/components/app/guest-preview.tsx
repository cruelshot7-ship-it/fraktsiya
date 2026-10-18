import { useMemo, useState } from "react";
import { STUDIO, formatLongDate, isSlotPast } from "@/data/studio";
import { slotTaken, useStudio } from "@/lib/studio-store";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { requestJoin, type JoinResult } from "@/lib/studio-sync";
import { getTelegramInitData, openTrainerChat } from "@/lib/telegram";
import { SectionLabel } from "@/components/app/bits";
import { cn } from "@/lib/utils";

const GOALS = ["Похудеть", "Сила", "Форма"] as const;

/** Единственное предложение на входе: пробный час. Цены и пакеты здесь не показываем. */
const TRIAL_LABEL = "Пробный час";
const ANY_TIME_LABEL = "Время: согласуем с тренером";

/** Что делать клиенту при отказе сервера. Без этого «не отправилось» не объясняет причину. */
const JOIN_FAIL: Record<NonNullable<JoinResult["reason"]>, string> = {
  consent: "Приложение обновилось. Закройте Telegram полностью и откройте зал снова.",
  session: "Не подтвердили вход в Telegram. Откройте зал из меню бота.",
  coach: "Не удалось определить тренера. Откройте зал из меню бота и отправьте заявку ещё раз.",
};

const OSWALD = "Oswald, 'Arial Narrow', sans-serif";

const FACTS = [
  { value: "60", label: "минут в зале" },
  { value: "1", label: "тренер" },
  { value: "Titan", label: "Лидская, 1" },
] as const;

/** Анимация первого экрана. Отключается при «уменьшить движение». */
const PRE_ENTRY_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Oswald:wght@500;600;700&display=swap');
.pre-rise{opacity:0;transform:translateY(14px);animation:pre-rise .7s cubic-bezier(.2,.7,.2,1) forwards}
.pre-d1{animation-delay:120ms}.pre-d2{animation-delay:200ms}.pre-d3{animation-delay:380ms}.pre-d4{animation-delay:520ms}.pre-d5{animation-delay:760ms}
@keyframes pre-rise{to{opacity:1;transform:none}}
.pre-rule{height:2px;width:56px;background:#c2362b;transform-origin:left;transform:scaleX(0);animation:pre-draw .9s cubic-bezier(.2,.7,.2,1) .25s forwards}
@keyframes pre-draw{to{transform:scaleX(1)}}
.pre-live{width:8px;height:8px;border-radius:9999px;background:#e8685c;animation:pre-pulse 2.2s ease-out infinite}
@keyframes pre-pulse{0%{box-shadow:0 0 0 0 rgba(232,104,92,.55)}70%{box-shadow:0 0 0 10px rgba(232,104,92,0)}100%{box-shadow:0 0 0 0 rgba(232,104,92,0)}}
.pre-cta{transition:transform .15s ease}
.pre-cta:active{transform:scale(.98)}
.pre-cta:focus-visible,.pre-ghost:focus-visible{outline:2px solid #f2f2f0;outline-offset:3px}
@media (prefers-reduced-motion: reduce){
  .pre-rise,.pre-rule{animation:none;opacity:1;transform:none}
  .pre-live{animation:none}
  .pre-cta{transition:none}
}
`;

export function OfferLanding({ live }: { live: boolean }) {
  const close = useStudio((s) => s.closeGuestPreview);
  const openNote = useStudio((s) => s.openNote);
  const showToast = useStudio((s) => s.showToast);
  const sendJoinRequest = useStudio((s) => s.sendJoinRequest);
  const slots = useStudio((s) => s.slots);
  const bookings = useStudio((s) => s.bookings);
  const trainerUsername = useStudio((s) => s.trainerUsername);
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
  // Заявка без времени: тренер согласует время сам (если свободных окон нет или ни одно не подходит).
  const [anyTime, setAnyTime] = useState(false);

  // запись возможна, только если есть свободные слоты; иначе главное действие — написать тренеру
  const canBook = openings.length > 0;
  const picked = openings.find((s) => s.id === slotId);
  const timeChosen = Boolean(picked) || anyTime;
  const waiting = live && (sent || Boolean(pending));

  async function submit() {
    if (!timeChosen) {
      showToast("Выберите время или «Согласуем с тренером».");
      return;
    }
    const offer = [TRIAL_LABEL, picked ? picked.label : ANY_TIME_LABEL, `Цель: ${goal}`].join("\n");
    if (!live) {
      setSent(true);
      showToast("Это показ. Заявка не ушла.");
      return;
    }
    setBusy(true);
    // Сначала сервер, потом экран: локальная «ожидающая» запись появляется только после ответа «ок».
    const res = await requestJoin({
      data: {
        initData: getTelegramInitData(),
        offer,
        slotId: picked?.id,
        goal,
        pack: TRIAL_LABEL,
        consentVersion: PRIVACY_VERSION,
      },
    }).catch((): JoinResult => ({ ok: false }));
    setBusy(false);
    if (!res.ok) {
      showToast((res.reason && JOIN_FAIL[res.reason]) || "Не отправилось. Напишите тренеру.");
      return;
    }
    sendJoinRequest(offer, { slotId: picked?.id, goal, pack: TRIAL_LABEL });
    setSent(true);
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
          <div className="rounded-xl bg-card p-5 shadow-border">
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
          <div className="flex min-h-[70dvh] flex-col rounded-3xl bg-[#0e0f11] p-5 text-[#f2f2f0]" style={{ fontFamily: "Manrope, system-ui, -apple-system, sans-serif" }}>
            <style>{PRE_ENTRY_CSS}</style>
            <div className="pre-rise flex items-center justify-between">
              <span className="text-xl tracking-[.14em] uppercase" style={{ fontFamily: OSWALD }}>Discipline</span>
              <span className="text-2xs text-[#8e929b]">{STUDIO.city} · Titan</span>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <span className="pre-rise pre-d1 inline-flex items-center gap-2 text-2xs font-semibold tracking-[.12em] uppercase text-[#e8685c]">
                <span className="pre-live" aria-hidden="true" />
                Первый визит
              </span>
              <h1 className="pre-rise pre-d2 m-0 text-[clamp(30px,10vw,40px)] leading-[0.95] font-semibold uppercase" style={{ fontFamily: OSWALD, overflowWrap: "break-word" }}>
                Один час.
                <br />
                Без обязательств.
              </h1>
              <div className="pre-rule" aria-hidden="true" />
              <p className="pre-rise pre-d3 mt-1.5 max-w-[330px] text-base leading-relaxed text-[#c9cbd0]">
                Тренер покажет технику в зале и подскажет, какой формат подойдёт именно вам. Если захотите продолжить — подберём программу под вашу цель.
              </p>
            </div>

            <div className="pre-rise pre-d4 mt-6 grid grid-cols-3 gap-2">
              {FACTS.map((fact) => (
                <div key={fact.label} className="rounded-xl border border-[#262930] bg-[#15171b] px-2.5 py-2.5">
                  <p className="m-0 text-[32px] leading-none" style={{ fontFamily: OSWALD }}>
                    {fact.value}
                  </p>
                  <p className="mt-1 text-2xs leading-tight text-[#8e929b]">{fact.label}</p>
                </div>
              ))}
            </div>
            <p className="pre-rise pre-d4 mt-4 text-sm text-[#8e929b]">Возьмите форму, воду и кроссовки.</p>

            <div className="pre-rise pre-d5 mt-auto flex flex-col gap-2.5 pt-6">
              {canBook ? (
                <>
                  <button
                    type="button"
                    className="pre-cta h-14 rounded-2xl text-base font-bold text-white"
                    style={{ background: "#c2362b" }}
                    onClick={() => setStep("time")}
                  >
                    Выбрать слот
                  </button>
                  <button type="button" className="pre-ghost h-11 text-sm text-[#c9cbd0]" onClick={() => openNote()}>
                    Сначала написать тренеру
                  </button>
                  <p className="mt-1 text-[11px] leading-snug text-[#8e929b]">
                    Заявка отправит тренеру ваше имя, @username и выбранное время. Согласие на обработку данных — на следующем шаге, до отправки.
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="pre-cta h-14 rounded-2xl text-base font-bold text-white"
                    style={{ background: "#c2362b" }}
                    onClick={() => {
                      if (!openTrainerChat(trainerUsername)) openNote();
                    }}
                  >
                    Связаться с тренером
                  </button>
                  <p className="mt-1 text-[11px] leading-snug text-[#8e929b]">
                    Свободных слотов сейчас нет. Напишите тренеру, он подскажет ближайшее время.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <button type="button" className="self-start text-sm text-muted-foreground" onClick={() => setStep("intro")}>
              Назад
            </button>
            <h1 className="font-display mt-3 text-4xl leading-none tracking-wide">Время</h1>
            <p className="mt-2 text-sm text-muted-foreground">{TRIAL_LABEL} · 60 минут</p>
            {openings.length === 0 ? (
              <p className="mt-5 text-sm leading-relaxed text-muted-foreground">Свободных окон сейчас нет. Отправьте заявку без времени: тренер предложит своё.</p>
            ) : null}
            <>
                <div className="mt-4 flex flex-col gap-2">
                  {openings.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => {
                        setSlotId(slot.id);
                        setAnyTime(false);
                      }}
                      className={cn(
                        "pressable rounded-xl px-4 py-3 text-left text-sm shadow-border",
                        slot.id === slotId ? "glow-ok bg-ok-dim" : "bg-card",
                      )}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAnyTime(true);
                    setSlotId("");
                  }}
                  className={cn(
                    "pressable mt-2 w-full rounded-xl px-4 py-3 text-left text-sm shadow-border",
                    anyTime ? "glow-ok bg-ok-dim" : "bg-card",
                  )}
                >
                  Согласуем время с тренером
                </button>
                <div className="mt-5">
                  <SectionLabel>Цель</SectionLabel>
                  <div className="mt-2 flex gap-1.5">
                    {GOALS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setGoal(option)}
                        className={cn(
                          "pressable h-10 flex-1 rounded-lg text-2xs font-medium",
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
                  disabled={busy || !timeChosen || !agreed}
                  className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
                  onClick={() => void submit()}
                >
                  {busy ? "…" : "Отправить заявку"}
                </button>
                <p className="mt-3 text-tiny text-muted-foreground">
                  Заявка уходит тренеру: имя, @username и выбранное время или «согласуем». Как мы обращаемся с данными — в «Профиль» → «Политика конфиденциальности». Замеры и самочувствие собираются только с вашего отдельного согласия.
                </p>
                <button type="button" className="mt-3 h-11 w-full text-sm text-muted-foreground" onClick={() => openNote()}>
                  Написать тренеру
                </button>
            </>
          </>
        )}
      </div>
    </div>
  );
}

export function GuestPreview() {
  return <OfferLanding live={false} />;
}
