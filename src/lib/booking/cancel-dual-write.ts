import { getTelegramInitData } from "@/lib/telegram";

/**
 * Отмена записи уходит и в Neon: без этого место остаётся занятым.
 * Три попытки с нарастающей паузой. Если сервер отказал по правам или попытки кончились — onFail.
 * `rev` — версия записи из ответа сервера при записи: повтор отмены не тронет запись, созданную заново.
 * Без Telegram (превью в браузере) и для записи без слота ничего не отправляем: в Neon её нет.
 */
export function scheduleCancelDualWrite(slotId: string, clientId: string, rev: string | null, onFail: () => void) {
  const initData = getTelegramInitData();
  if (!initData || !slotId) return;
  const attempt = async (left: number, delayMs: number): Promise<void> => {
    try {
      const { cancelBookingFn } = await import("@/lib/booking/server");
      const res = await cancelBookingFn({ data: { initData, slotId, clientId, ...(rev ? { rev } : {}) } });
      if (res.ok) return;
      if (res.reason === "forbidden" || res.reason === "already-attended") {
        onFail();
        return;
      }
    } catch {
      /* сеть: пробуем ещё раз */
    }
    if (left <= 1) {
      onFail();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return attempt(left - 1, delayMs * 3);
  };
  void attempt(3, 1000);
}
