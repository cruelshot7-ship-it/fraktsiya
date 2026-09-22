import { useStudio } from "@/lib/studio-store";
import { openTrainerChat } from "@/lib/telegram";

export function JoinGate() {
  const trainerUsername = useStudio((s) => s.trainerUsername);
  const showToast = useStudio((s) => s.showToast);

  return (
    <div className="rounded-xl bg-card px-5 py-10 text-center shadow-border">
      <p className="font-display text-xl">Нужна ссылка тренера</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        В зал можно войти только по приглашению. Напишите тренеру — он пришлёт ссылку.
      </p>
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
