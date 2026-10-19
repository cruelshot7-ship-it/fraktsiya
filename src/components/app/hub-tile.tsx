import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Крупная плитка-раздел для экранов-хабов (сейчас только «Ещё»).
 * Цвета берутся из токенов темы: карточка, красный акцент, основной текст.
 * На рабочих экранах (программа, сессия, формы) не использовать: там нужна компактность.
 */
export function HubTile({
  title,
  hint,
  onClick,
  className,
}: {
  title: string;
  hint?: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "pressable flex min-h-[4.5rem] w-full items-center justify-between gap-3 rounded-[1rem] border border-primary/50 bg-card px-4 py-3 text-left",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold uppercase tracking-wide text-foreground">{title}</span>
        {hint ? <span className="mt-0.5 block text-tiny text-muted-foreground">{hint}</span> : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-primary" aria-hidden="true" />
    </button>
  );
}
