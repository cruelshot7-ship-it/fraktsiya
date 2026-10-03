import { useState } from "react";
import { BookingsView } from "@/components/app/bookings-view";
import { SlotsView } from "@/components/app/slots-view";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

/**
 * Блок B · Расписание
 * Подтабы: Слоты | Записи — только визуальный слой DS.
 */
export function ScheduleView() {
  const role = useStudio((s) => s.role);
  const [sub, setSub] = useState<"slots" | "bookings">("slots");

  return (
    <div className="space-y-3">
      <div className="ds-seg" role="tablist" aria-label="Раздел расписания">
        <button
          type="button"
          role="tab"
          aria-selected={sub === "slots"}
          data-active={sub === "slots"}
          className={cn("pressable ds-seg-btn", sub === "slots" && "is-active")}
          onClick={() => setSub("slots")}
        >
          {role === "trainer" ? "Слоты" : "Записаться"}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sub === "bookings"}
          data-active={sub === "bookings"}
          className={cn("pressable ds-seg-btn", sub === "bookings" && "is-active")}
          onClick={() => setSub("bookings")}
        >
          {role === "trainer" ? "Записи" : "Мои записи"}
        </button>
      </div>
      {sub === "slots" ? <SlotsView /> : <BookingsView />}
    </div>
  );
}
