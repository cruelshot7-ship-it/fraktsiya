import { useStudio } from "@/lib/studio-store";
import { openTrainerChat } from "@/lib/telegram";

export function JoinGate() {
  const trainerUsername = useStudio((s) => s.trainerUsername);

  return (
    <div className="rounded-xl bg-card px-5 py-10 text-center shadow-border">
      <p className="font-display text-xl">Вас ещё нет в зале</p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Тренер добавляет клиентов сам. Напишите ему — и после этого откроются слоты и программа.
      </p>
      <button
        type="button"
        className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => openTrainerChat(trainerUsername)}
      >
        Написать тренеру
      </button>
    </div>
  );
}
