import type { StudioPayload } from "@/lib/studio-sync";
import { trainerAlertsEnabled, trainerBookingAlertText, type BookingAlertKind } from "@/lib/booking/trainer-alert";

/**
 * Пишет тренеру в Telegram о записи или отмене клиента. Ошибка отправки не должна ломать запись:
 * запись уже в Neon, сообщение — вторично.
 */
export async function alertTrainerOfBooking(args: {
  /** загрузка состояния — внутри защищённого блока: сбой чтения не должен портить уже сделанную запись */
  loadPayload: () => Promise<StudioPayload>;
  ownerCoachId: string;
  slotId: string;
  clientId: string;
  kind: BookingAlertKind;
}): Promise<void> {
  try {
    const payload = await args.loadPayload();
    if (!trainerAlertsEnabled(payload.notifyPrefs)) return;
    const slot = (payload.extraSlots ?? []).find((s) => s.id === args.slotId);
    if (!slot) return;
    const telegramId = args.clientId.replace(/^tg_/, "");
    const client = payload.clients.find((c) => c.id === args.clientId || c.telegramId === telegramId);
    const name = client ? `${client.firstName} ${client.lastName}` : "";
    const bot = await import("@/lib/telegram-bot.server");
    await bot.sendTrainerAlert(args.ownerCoachId, trainerBookingAlertText(args.kind, name, slot.date, slot.time));
  } catch (err) {
    console.error("[trainer-alert]", err);
  }
}
