import { useState } from "react";
import { NutritionView } from "@/components/app/nutrition-view";
import { FormView } from "@/components/app/form-view";
import { HallView } from "@/components/app/hall-view";
import { cn } from "@/lib/utils";

/**
 * Блок F · Ещё (клиент): Еда / Форма / Зал
 */
export function MoreView() {
  const [sub, setSub] = useState<"food" | "form" | "hall">("food");

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-secondary/80 p-1">
        {(
          [
            ["food", "Еда"],
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
      {sub === "food" ? <NutritionView /> : null}
      {sub === "form" ? <FormView /> : null}
      {sub === "hall" ? <HallView /> : null}
    </div>
  );
}
