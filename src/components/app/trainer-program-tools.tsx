import { TRAINER_TG_ID } from "@/data/studio";
import { ProgressionPanel } from "@/components/app/progression-panel";
import { TemplatesPanel } from "@/components/app/templates-panel";
import { CopySessionPanel } from "@/components/app/copy-session-panel";

type Props = { clientId: string; coachId?: string | null };

/** Trainer-only stack under program tab. */
export function TrainerProgramTools({ clientId, coachId }: Props) {
  const coach = coachId || String(TRAINER_TG_ID);
  return (
    <div className="mt-3 flex flex-col gap-3">
      <ProgressionPanel
        clientId={clientId}
        coachId={coach}
        programId={`prog_${coach}_${clientId}`}
      />
      <TemplatesPanel />
      <CopySessionPanel />
    </div>
  );
}
