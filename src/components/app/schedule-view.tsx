import { useState } from "react";
import { SlotsView } from "@/components/app/slots-view";
import { BookingsView } from "@/components/app/bookings-view";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

/**
 * Блок B · Расписание
 * Подтабы: Слоты | Записи
 */
export function ScheduleView() {
  const role = useStudio((s) => s.role);
  const [sub, setSub] = useState<"slots" | "bookings">("slots");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-secondary/80 p-1">
        <button
          type="button"
          className={cn(
            "pressable h-9 flex-1 rounded-lg text-sm font-medium",
            sub === "slots" ? "bg-card shadow-border" : "text-muted-foreground",
          )}
          onClick={() => setSub("slots")}
        >
          {role === "trainer" ? "Слоты" : "Записаться"}
        </button>
        <button
          type="button"
          className={cn(
            "pressable h-9 flex-1 rounded-lg text-sm font-medium",
            sub === "bookings" ? "bg-card shadow-border" : "text-muted-foreground",
          )}
          onClick={() => setSub("bookings")}
        >
          {role === "trainer" ? "Записи" : "Мои записи"}
        </button>
      </div>
      {sub === "slots" ? <SlotsView /> : <BookingsView />}
    </div>
  );
}
