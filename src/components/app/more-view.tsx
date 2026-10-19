import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ChevronRight } from "lucide-react";
import { FormView } from "@/components/app/form-view";
import { HallView } from "@/components/app/hall-view";
import { MyDataPanel, PolicyText } from "@/components/app/privacy-panel";
import { SectionLabel, Surface } from "@/components/app/bits";
import { activeClient, useStudio } from "@/lib/studio-store";
import { addDays, BOT_USERNAME, clientFlag, isoDate, sessionsRu, startOfWeek, TRAINER_TG_ID } from "@/data/studio";
import { referralStart } from "@/lib/referral";
import { getTelegramUser, inviteUrl } from "@/lib/telegram";
import { FEATURES } from "@/lib/features";
import { cn } from "@/lib/utils";

type Sub = "menu" | "form" | "hall" | "privacy" | "policy";

/**
 * Ещё (клиент): короткое меню, без лишних переключателей на первом экране.
 * Профиль тренера: ссылка для клиентов и сводка (перенесено со вкладки «Клиенты»).
 */
export function MoreView({ initial, role = "client" }: { initial?: "form" | "hall"; role?: "client" | "trainer" }) {
  const [sub, setSub] = useState<Sub>(initial ?? "menu");
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const openNote = useStudio((s) => s.openNote);
  const showToast = useStudio((s) => s.showToast);
  const me = activeClient({ clients, activeClientId });
  const referralUrl = me?.referralCode ? inviteUrl(BOT_USERNAME, referralStart(me.referralCode)) : "";

  useEffect(() => {
    if (initial) setSub(initial);
  }, [initial]);

  if (role === "trainer") return <TrainerProfile />;

  if (sub === "policy") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Профиль
        </button>
        <Surface>
          <PolicyText />
        </Surface>
      </div>
    );
  }

  if (sub === "privacy") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Профиль
        </button>
        <MyDataPanel />
      </div>
    );
  }

  if (sub === "form") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Профиль
        </button>
        <FormView />
      </div>
    );
  }

  if (sub === "hall") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Профиль
        </button>
        <HallView />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Профиль</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">Данные, зал и связь с тренером</p>
      </div>

      {me ? (
        <Surface>
          <p className="text-sm font-medium">
            {me.firstName} {me.lastName}
          </p>
          <p className="mt-1 text-tiny text-muted-foreground">
            На балансе {me.sessionsLeft ?? 0} {sessionsRu(me.sessionsLeft ?? 0)}
            {me.programTitle ? ` · ${me.programTitle}` : ""}
          </p>
        </Surface>
      ) : null}


      <button type="button" className="pressable w-full rounded-[1rem] text-left" onClick={() => setSub("policy")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Политика конфиденциальности</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Какие данные, зачем и кому передаются</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>

      <button type="button" className="pressable w-full rounded-[1rem] text-left" onClick={() => setSub("privacy")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Мои данные</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Политика, согласие, удаление</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>

      {FEATURES.hall ? (
      <button type="button" className="pressable w-full rounded-[1rem] text-left" onClick={() => setSub("hall")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Зал</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Стойки, техника, маршрут</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>
      ) : null}


      {referralUrl ? (
        <Surface>
          <p className="text-sm font-medium">Пригласить друга</p>
          <p className="mt-0.5 text-tiny text-muted-foreground">
            Когда друг оплатит первый пакет, тренер начислит вам занятие в подарок.
          </p>
          <button
            type="button"
            className="pressable mt-3 min-h-11 w-full rounded-lg bg-secondary px-3 text-sm"
            onClick={() => {
              void navigator.clipboard?.writeText(referralUrl);
              showToast("Ссылка скопирована.");
            }}
          >
            Скопировать ссылку
          </button>
        </Surface>
      ) : null}

      <button type="button" className="pressable w-full rounded-[1rem] text-left" onClick={() => openNote()}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Написать тренеру</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Вопрос по плану или записи</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>
    </div>
  );
}

function ProfileStat({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <div>
      <p className={cn("font-display text-2xl tabular-nums leading-none", alert && "text-alert-text")}>{value}</p>
      <p className="mt-1 text-tiny text-muted-foreground">{label}</p>
    </div>
  );
}

/** Профиль тренера: ссылка для клиентов и сводка. Список «Внимание» — во вкладке «Клиенты». */
function TrainerProfile() {
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const food = useStudio((s) => s.food);
  const visits = useStudio((s) => s.visits);
  const showToast = useStudio((s) => s.showToast);
  const tgUser = getTelegramUser();
  const myLink = inviteUrl(BOT_USERNAME, `c_${tgUser?.id ?? TRAINER_TG_ID}`);
  // QR рисуется в браузере: ссылка не уходит в сторонние сервисы
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(myLink, { width: 180, margin: 1 })
      .then((url) => {
        if (alive) setQrSrc(url);
      })
      .catch(() => {
        if (alive) setQrSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [myLink]);
  const today = isoDate(new Date());
  const weekEnd = isoDate(addDays(startOfWeek(new Date()), 7));
  const todayCount = bookings.filter((b) => b.date === today).length;
  const weekBookings = bookings.filter((b) => b.date >= today && b.date < weekEnd).length;
  const attentionCount = clients.filter((c) => clientFlag(c, today, food, bookings, visits).attention).length;

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Профиль тренера</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">Ссылка для клиентов и сводка</p>
      </div>

      <Surface className="glow-hero">
        <SectionLabel>Ваши клиенты</SectionLabel>
        <p className="mt-2 text-2xs text-muted-foreground">По этой ссылке человек попадает только к вам. Чужих клиентов не видно.</p>
        <div className="mt-3 flex flex-col items-center gap-2">
          {qrSrc ? (
            <img src={qrSrc} alt="QR-код ссылки для клиентов" width={180} height={180} className="rounded-xl bg-white p-2" />
          ) : (
            <div aria-hidden="true" className="size-[180px] rounded-xl bg-secondary" />
          )}
          <p className="text-center text-tiny text-muted-foreground">
            Покажите QR: человек сканирует его и отправляет заявку. Когда вы её подтвердите, он появится в «Клиентах».
          </p>
        </div>
        <button
          type="button"
          className="pressable mt-3 min-h-11 w-full rounded-lg bg-secondary px-3 text-left text-2xs text-muted-foreground"
          onClick={() => {
            void navigator.clipboard?.writeText(myLink);
            showToast("Ссылка скопирована");
          }}
        >
          {myLink}
        </button>
      </Surface>

      <Surface>
        <SectionLabel>Сводка</SectionLabel>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <ProfileStat value={todayCount} label="записей сегодня" />
          <ProfileStat value={attentionCount} label="требуют внимания" alert />
          <ProfileStat value={weekBookings} label="записей на неделю" />
        </div>
        <p className="mt-3 text-tiny text-muted-foreground">
          Внимание: осталось 2 занятия или меньше (включая 0) либо без тренировок больше 14 дней. Клиенты на заморозке не попадают. Остальные сигналы (отчёт, калории, отмены, срок пакета) видны на карточке, но не в «Внимании». Список — во вкладке «Клиенты», фильтр «Внимание».
        </p>
      </Surface>
    </div>
  );
}
