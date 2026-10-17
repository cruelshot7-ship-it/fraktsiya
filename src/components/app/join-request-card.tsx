import type { JoinRequest } from "@/data/studio";
import { confirmAction } from "@/lib/confirm";
import { joinConfirmText, joinRejectText } from "@/lib/join-confirm";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

/**
 * Заявка в зал: имя, ник, текст и кнопки «Принять» / «Отклонить» с подтверждением.
 * Обёртку (карточку) задаёт экран; здесь только содержимое.
 */
export function JoinRequestCard({
  req,
  fallbackMessage,
  label,
  preLine = false,
}: {
  req: JoinRequest;
  fallbackMessage: string;
  label?: string;
  preLine?: boolean;
}) {
  const approveJoin = useStudio((s) => s.approveJoin);
  const rejectJoin = useStudio((s) => s.rejectJoin);
  return (
    <>
      {label ? <p className="text-2xs font-medium tracking-wide text-muted-foreground">{label}</p> : null}
      <p className={cn("text-base font-display", label && "mt-1")}>
        {req.firstName} {req.lastName}
      </p>
      {req.telegramUsername ? <p className="text-tiny text-muted-foreground">@{req.telegramUsername}</p> : null}
      <p className={cn("mt-1 text-sm text-muted-foreground", preLine && "whitespace-pre-line")}>
        {req.message || fallbackMessage}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="pressable h-11 rounded-xl bg-primary text-sm font-medium text-primary-foreground"
          onClick={async () => {
            if (await confirmAction(joinConfirmText(req))) approveJoin(req.id);
          }}
        >
          Принять
        </button>
        <button
          type="button"
          className="pressable h-11 rounded-xl bg-secondary text-sm"
          onClick={async () => {
            if (await confirmAction(joinRejectText(req))) rejectJoin(req.id);
          }}
        >
          Отклонить
        </button>
      </div>
    </>
  );
}
