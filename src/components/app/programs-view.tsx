import { ChevronRight } from "lucide-react";
import { useStudio } from "@/lib/studio-store";
import { EmptyHint, SectionLabel, Surface } from "@/components/app/bits";

/**
 * Вкладка тренера «Программы»: список клиентов с программами.
 * Нажатие открывает карточку клиента сразу в редакторе программы (назначить или изменить).
 */
export function ProgramsView() {
  const clients = useStudio((s) => s.clients);
  const openClientSheet = useStudio((s) => s.openClientSheet);

  if (clients.length === 0) {
    return <EmptyHint>Клиентов пока нет. Программы появятся, когда клиенты подключатся.</EmptyHint>;
  }

  return (
    <div className="stagger-in flex flex-col gap-3">
      <SectionLabel>Программы клиентов</SectionLabel>
      <ul className="flex flex-col gap-2">
        {clients.map((c) => {
          const hasProgram = Boolean(c.programTitle?.trim()) || c.sessions.length > 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => openClientSheet(c.id, "program")}
                className="pressable flex w-full items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-3 text-left shadow-border"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-base leading-tight">
                    {c.firstName} {c.lastName}
                  </span>
                  <span className="mt-0.5 block truncate text-tiny text-muted-foreground">
                    {hasProgram
                      ? `${c.programTitle || "Программа"} · ${c.programWeeks} нед · ${c.sessions.length} тр.`
                      : "Программа не назначена"}
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
