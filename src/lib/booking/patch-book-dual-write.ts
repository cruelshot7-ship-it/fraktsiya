/**
 * Runtime patch: dual-write bookSlot + attendance when this module is imported.
 * Avoids rewriting the large studio-store.ts blob on the remote branch.
 */
import { useStudio } from "@/lib/studio-store";

let patched = false;

export function ensureBookDualWrite() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const state = useStudio.getState();
  if (!state?.bookSlot) return;

  const origBook = state.bookSlot.bind(state);
  const origCheckIn = state.checkIn?.bind(state);
  const origNoShow = state.markNoShow?.bind(state);

  useStudio.setState({
    bookSlot: (id: string, forClientId?: string) => {
      const ok = origBook(id, forClientId);
      if (!ok) return false;
      const s = useStudio.getState();
      const slot = s.slots.find((x) => x.id === id);
      const clientId = forClientId ?? s.activeClientId;
      if (slot && clientId) {
        void import("@/lib/booking/client-dual-write").then(({ scheduleBookDualWrite }) => {
          scheduleBookDualWrite(slot, clientId, (reason) => {
            s.showToast(
              reason === "full"
                ? "Слот только что заняли. Обновите список."
                : "Запись уже есть на сервере.",
            );
          });
        });
      }
      return true;
    },
    checkIn: (bookingId: string) => {
      origCheckIn?.(bookingId);
      void import("@/lib/booking/client-dual-write").then(({ scheduleAttendanceDualWrite }) => {
        scheduleAttendanceDualWrite(bookingId, true);
      });
    },
    markNoShow: (bookingId: string) => {
      origNoShow?.(bookingId);
      void import("@/lib/booking/client-dual-write").then(({ scheduleAttendanceDualWrite }) => {
        scheduleAttendanceDualWrite(bookingId, false);
      });
    },
  });
}
