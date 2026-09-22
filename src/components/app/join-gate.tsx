import { useState } from "react";
import { useStudio } from "@/lib/studio-store";
import { getTelegramUser, openTrainerChat } from "@/lib/telegram";
import { Field, inputClass } from "@/components/app/bits";

export function JoinGate() {
  const joinRequests = useStudio((s) => s.joinRequests);
  const sendJoinRequest = useStudio((s) => s.sendJoinRequest);
  const trainerUsername = useStudio((s) => s.trainerUsername);
  const showToast = useStudio((s) => s.showToast);
  const user = getTelegramUser();
  const mine = joinRequests.find((r) => r.telegramId === String(user?.id ?? "") && r.status !== "rejected");
  const [message, setMessage] = useState("");

  if (mine?.status === "pending") {
    return (
      <div className="rounded-xl bg-card px-5 py-10 text-center shadow-border">
        <p className="font-display text-xl">Заявка у тренера</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {mine.message ? `«${mine.message}»` : "Ждите одобрения. Слоты откроются после того, как вас примут."}
        </p>
      </div>
    );
  }

  if (mine?.status === "rejected") {
    return (
      <div className="rounded-xl bg-card px-5 py-10 text-center shadow-border">
        <p className="font-display text-xl">Заявку не приняли</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Напишите тренеру в личку, если это ошибка.</p>
        <button
          type="button"
          className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            if (!openTrainerChat(trainerUsername)) showToast("Напишите тренеру в Telegram.");
          }}
        >
          Написать тренеру
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-card px-5 py-6 shadow-border">
        <p className="font-display text-xl">Заявка в зал</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Слоты закроются, пока тренер не примет вас. Коротко напишите, кто вы.
        </p>
        <p className="mt-3 text-sm">
          {user?.first_name} {user?.last_name} {user?.username ? `@${user.username}` : ""}
        </p>
        <Field label="Сообщение тренеру">
          <textarea
            className={`${inputClass} mt-0 h-28 resize-none py-2`}
            value={message}
            placeholder="Хочу тренироваться. Знакомы / от кого пришёл."
            onChange={(e) => setMessage(e.target.value)}
          />
        </Field>
        <button
          type="button"
          className="pressable mt-3 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={() => {
            if (!message.trim()) {
              showToast("Напишите пару слов о себе.");
              return;
            }
            sendJoinRequest(message.trim());
          }}
        >
          Отправить заявку
        </button>
      </div>
    </div>
  );
}
