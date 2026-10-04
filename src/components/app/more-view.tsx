import { useEffect, useState } from "react";
import { FormView } from "@/components/app/form-view";
import { HallView } from "@/components/app/hall-view";
import { cn } from "@/lib/utils";

type Sub = "form" | "hall";

/**
 * Блок F · Ещё (клиент): Форма / Зал
 * Еда вынесена в отдельную вкладку (NutritionView в mini-app).
 */
export function MoreView({ initial }: { initial?: Sub }) {
  const [sub, setSub] = useState<Sub>(initial ?? "form");

  useEffect(() => {
    if (initial) setSub(initial);
  }, [initial]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-secondary/80 p-1">
        {(
          [
            ["form", "Форма"],
            ["hall", "Зал"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "pressable h-9 flex-1 rounded-lg text-sm font-medium",
              sub === id ? "bg-card shadow-border" : "text-muted-foreground",
            )}
            onClick={() => setSub(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {sub === "form" ? <FormView /> : null}
      {sub === "hall" ? <HallView /> : null}
    </div>
  );
}
