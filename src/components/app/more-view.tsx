import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { FormView } from "@/components/app/form-view";
import { HallView } from "@/components/app/hall-view";
import { MyDataPanel } from "@/components/app/privacy-panel";
import { SectionLabel, Surface } from "@/components/app/bits";
import { activeClient, useStudio } from "@/lib/studio-store";
import { sessionsRu } from "@/data/studio";

type Sub = "menu" | "form" | "hall" | "privacy";

/**
 * Ещё (клиент): короткое меню, без лишних переключателей на первом экране.
 */
export function MoreView({ initial }: { initial?: "form" | "hall" }) {
  const [sub, setSub] = useState<Sub>(initial ?? "menu");
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const openNote = useStudio((s) => s.openNote);
  const setTab = useStudio((s) => s.setTab);
  const me = activeClient({ clients, activeClientId });

  useEffect(() => {
    if (initial) setSub(initial);
  }, [initial]);

  if (sub === "privacy") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Ещё
        </button>
        <MyDataPanel />
      </div>
    );
  }

  if (sub === "form") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Ещё
        </button>
        <FormView />
      </div>
    );
  }

  if (sub === "hall") {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setSub("menu")}
          className="pressable self-start min-h-11 text-sm text-muted-foreground"
        >
          ← Ещё
        </button>
        <HallView />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Ещё</SectionLabel>
        <p className="mt-1 text-tiny text-muted-foreground">Редко нужно · не мешает основным вкладкам</p>
      </div>

      {me ? (
        <Surface>
          <p className="text-sm font-medium">
            {me.firstName} {me.lastName}
          </p>
          <p className="mt-1 text-tiny text-muted-foreground">
            На балансе {me.sessionsLeft ?? 0} {sessionsRu(me.sessionsLeft ?? 0)}
            {me.programTitle ? ` · ${me.programTitle}` : ""}
          </p>
        </Surface>
      ) : null}

      <button type="button" className="pressable w-full text-left" onClick={() => setSub("form")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Форма</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Шаги, сон, вода, лёгкое движение</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>

      <button type="button" className="pressable w-full text-left" onClick={() => setSub("privacy")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Мои данные</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Политика, согласие, удаление</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>

      <button type="button" className="pressable w-full text-left" onClick={() => setSub("hall")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Зал</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Стойки, техника, маршрут</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>

      <button type="button" className="pressable w-full text-left" onClick={() => setTab("schedule")}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Записи и баланс</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Ближайшие слоты · списания</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>

      <button type="button" className="pressable w-full text-left" onClick={() => openNote()}>
        <Surface className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Написать тренеру</p>
            <p className="mt-0.5 text-tiny text-muted-foreground">Вопрос по плану или записи</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Surface>
      </button>
    </div>
  );
}
