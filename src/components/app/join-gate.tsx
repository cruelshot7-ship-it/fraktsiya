import { useStudio } from "@/lib/studio-store";

export function JoinGate() {
  const joinRequests = useStudio((s) => s.joinRequests);
  const openNote = useStudio((s) => s.openNote);
  const pending = joinRequests.some((r) => r.status === "pending");
  const rejected = joinRequests.some((r) => r.status === "rejected");

  return (
    <div className="rounded-xl bg-card px-5 py-10 text-center shadow-border">
      <p className="font-display text-xl">
        {rejected ? "Заявку не приняли" : pending ? "Заявка у тренера" : "Заявка отправлена"}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {rejected
          ? "Напишите тренеру в личку, если это ошибка."
          : "Нажмите Старт в боте. Тренер получит уведомление и примет вас. Потом откроются слоты, программа и питание."}
      </p>
      <button
        type="button"
        className="pressable mt-5 h-12 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={() => openNote()}
      >
        Написать тренеру
      </button>
    </div>
  );
}
