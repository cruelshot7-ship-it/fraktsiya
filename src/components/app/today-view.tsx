import { ActionCenter } from "@/components/app/action-center";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { ProgramView } from "@/components/app/program-view";
import { BookingsView } from "@/components/app/bookings-view";
import { useStudio } from "@/lib/studio-store";
import { SectionLabel } from "@/components/app/bits";

/**
 * Блок A · Мой день
 * Клиент: задачи + программа сегодня
 * Тренер: центр действий + ближайшие записи (без дубля ActionCenter внутри)
 */
export function TodayView() {
  const role = useStudio((s) => s.role);

  if (role === "trainer") {
    return (
      <div className="space-y-4">
        <div>
          <SectionLabel>Сегодня</SectionLabel>
          <p className="mt-1 text-tiny text-muted-foreground">
            Задачи по сессиям и ближайшие записи
          </p>
        </div>
        <ActionCenter />
        <BookingsView />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <SectionLabel>Мой день</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">
          Что сделать сейчас · программа · прогресс
        </p>
      </div>
      <SoftReturnPanel />
      <ActionCenter />
      <ProgramView />
    </div>
  );
}
