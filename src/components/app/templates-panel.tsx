import { useMemo, useState } from "react";
import { TRAINER_TG_ID } from "@/data/studio";
import { useStudio } from "@/lib/studio-store";
import {
  assignTemplateToClient,
  type ProgramTemplate,
  type TemplateExercise,
} from "@/lib/templates/program-template";
import { SectionLabel, Surface } from "@/components/app/bits";

const SEED: ProgramTemplate = {
  id: "tpl_base_a",
  coachId: String(TRAINER_TG_ID),
  title: "База · полный день",
  version: 1,
  updatedAt: "2026-01-01T00:00:00Z",
  exercises: [
    { name: "Присед", sets: 3, repsMin: 5, repsMax: 8, load: 60, unit: "kg" },
    { name: "Жим лёжа", sets: 3, repsMin: 5, repsMax: 8, load: 40, unit: "kg" },
    { name: "Тяга", sets: 3, repsMin: 6, repsMax: 10, load: 50, unit: "kg" },
  ],
};

function exercisesToItems(ex: TemplateExercise[]): string[] {
  return ex.map((e) => {
    const load = e.unit === "bw" ? "свой вес" : e.load != null ? `${e.load} ${e.unit ?? "kg"}` : "";
    return [e.name, `${e.sets}×${e.repsMin}-${e.repsMax}`, load].filter(Boolean).join(" · ");
  });
}

export function TemplatesPanel() {
  const role = useStudio((s) => s.role);
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const updateClient = useStudio((s) => s.updateClient);
  const showToast = useStudio((s) => s.showToast);
  const client = clients.find((c) => c.id === activeClientId);
  const [tpl] = useState(SEED);
  const preview = useMemo(() => exercisesToItems(tpl.exercises), [tpl]);

  if (role !== "trainer" || !client) return null;

  function assign() {
    if (client!.sessions.some((s) => s.name === tpl.title)) {
      showToast("Этот шаблон уже есть в программе клиента.");
      return;
    }
    // the template's loads are fixed numbers, not this client's: the trainer checks them first
    const ok = window.confirm(
      `Добавить клиенту день «${tpl.title}»?\n\n${preview.join("\n")}\n\nСуществующие дни не меняются. Веса в шаблоне общие — проверьте под клиента.`,
    );
    if (!ok) return;
    const copy = assignTemplateToClient(tpl, client!.id);
    const day = {
      id: copy.id,
      name: copy.title,
      focus: "из шаблона",
      items: exercisesToItems(copy.exercises),
    };
    updateClient(client!.id, {
      sessions: [...client!.sessions, day],
      programTitle: client!.programTitle || copy.title,
    });
    const n = {
      id: `nt_tpl_${copy.id}`,
      audience: "client" as const,
      clientId: client!.id,
      kind: "alert" as const,
      title: "В программу добавлен день",
      body: copy.title,
      at: new Date().toISOString(),
    };
    useStudio.setState((st) => ({ notices: [n, ...st.notices].slice(0, 40) }));
    showToast("Шаблон назначен клиенту (копия).");
  }

  return (
    <Surface>
      <SectionLabel>Шаблон программы</SectionLabel>
      <p className="mt-2 text-sm font-medium">{tpl.title}</p>
      <ul className="mt-2 space-y-1 text-tiny text-muted-foreground">
        {preview.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-2xs text-muted-foreground">Назначение создаёт копию у клиента.</p>
      <button
        type="button"
        className="pressable mt-3 h-11 w-full rounded-xl bg-primary text-sm font-medium text-primary-foreground"
        onClick={assign}
      >
        Назначить активному клиенту
      </button>
    </Surface>
  );
}
