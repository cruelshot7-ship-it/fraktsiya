import { useStudio } from "@/lib/studio-store";
import { TrainerSlots } from "@/components/app/trainer-slots";
import { ClientSlots } from "@/components/app/client-slots";

export function SlotsView() {
  const role = useStudio((s) => s.role);
  return role === "trainer" ? <TrainerSlots /> : <ClientSlots />;
}
