import { TRAINER_TG_ID, isoDate } from "@/data/studio";
import { activeClient, useStudio } from "@/lib/studio-store";
import { DecisionBanner } from "@/components/app/decision-banner";
import { SessionResultForm } from "@/components/app/session-result-form";
import { SoftReturnPanel } from "@/components/app/soft-return";
import { ProgramHistoryPanel } from "@/components/app/program-history-panel";

export function ProgramCycleExtras() {
  const clients = useStudio((s) => s.clients);
  const activeClientId = useStudio((s) => s.activeClientId);
  const bookings = useStudio((s) => s.bookings);
  const client = activeClient({ clients, activeClientId });
  if (!client) return <DecisionBanner />;

  const today = isoDate(new Date());
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);

  return (
    <div className="mb-3 flex flex-col gap-3">
      <SoftReturnPanel />
      <DecisionBanner />
      <ProgramHistoryPanel />
      {todayBook ? (
        <SessionResultForm
          bookingId={todayBook.id}
          clientId={client.id}
          coachId={client.coachId || String(TRAINER_TG_ID)}
          attendanceConfirmed={Boolean(todayBook.checkedIn)}
          programId={`prog_${client.coachId || TRAINER_TG_ID}_${client.id}`}
        />
      ) : null}
    </div>
  );
}
