import { ChevronRight } from "lucide-react";
import { useStudio } from "@/lib/studio-store";
import { EmptyHint, SectionLabel } from "@/components/app/bits";
import { isoDate, type Client } from "@/data/studio";

function hasProgramOf(c: Client): boolean {
  return Boolean(c.programTitle?.trim()) || c.sessions.length > 0;
}

/**
 * Клиент записан на сегодня или уже в зале: тренеру нужен день программы с отметками подходов.
 */
function hasVisitToday(c: Client, today: string, bookings: { clientId: string; date: string }[], visits: { clientId: string; date: string }[]): boolean {
  return (
    bookings.some((b) => b.clientId === c.id && b.date === today) ||
    visits.some((v) => v.clientId === c.id && v.date === today)
  );
}

/**
 * Вкладка тренера «Программы»: список клиентов с программами.
 * Сначала клиенты без программы: там действие.
 * Клиент с записью на сегодня или уже в зале открывает день программы с отметками;
 * остальные открывают редактор программы.
 */
export function ProgramsView() {
  const clients = useStudio((s) => s.clients);
  const bookings = useStudio((s) => s.bookings);
  const visits = useStudio((s) => s.visits);
  const openClientSheet = useStudio((s) => s.openClientSheet);
  const setActiveClient = useStudio((s) => s.setActiveClient);
  const setTab = useStudio((s) => s.setTab);
  const today = isoDate(new Date());

  if (clients.length === 0) {
    return <EmptyHint>Клиентов пока нет. Программы появятся, когда клиенты подключатся.</EmptyHint>;
  }

  const without = clients.filter((c) => !hasProgramOf(c));
  const withProgram = clients.filter(hasProgramOf);

  const renderList = (list: Client[]) => (
    <ul className="flex flex-col gap-2">
      {list.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => {
              if (hasVisitToday(c, today, bookings, visits)) {
                setActiveClient(c.id);
                setTab("program");
                return;
              }
              openClientSheet(c.id, "program");
            }}
            className="pressable flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-card px-3.5 py-3 text-left shadow-border"
          >
            <span className="min-w-0">
              <span className="block truncate font-display text-base leading-tight">
                {c.firstName} {c.lastName}
              </span>
              <span className="mt-0.5 block truncate text-tiny text-muted-foreground">
                {hasProgramOf(c)
                  ? `${c.programTitle || "Программа"} · ${c.programWeeks} нед · ${c.sessions.length} тр.`
                  : "Назначить программу"}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="stagger-in flex flex-col gap-3">
      {without.length > 0 ? (
        <>
          <SectionLabel>Без программы · {without.length}</SectionLabel>
          {renderList(without)}
        </>
      ) : null}
      {withProgram.length > 0 ? (
        <>
          <SectionLabel>{without.length > 0 ? `С программой · ${withProgram.length}` : `Программы клиентов · ${withProgram.length}`}</SectionLabel>
          {renderList(withProgram)}
        </>
      ) : null}
    </div>
  );
}
