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
  const role = useStudio((s) => s.role);
  const client = activeClient({ clients, activeClientId });
  if (!client) return <DecisionBanner />;

  const today = isoDate(new Date());
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);

  return (
    <div className="mb-3 flex flex-col gap-3">
      <SoftReturnPanel />
      <DecisionBanner />
      <ProgramHistoryPanel />
      {/* the client records the workout in the card below; the form is the trainer's record. A client's
          copy never reached the server (the server refuses client results), so it only lived on the device. */}
      {todayBook && role === "trainer" ? (
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
