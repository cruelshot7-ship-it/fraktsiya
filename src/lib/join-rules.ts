/**
 * «Уже в зале» — только по числовому telegramId.
 *
 * Карточка, созданная тренером вручную (с @username, но без telegramId), ещё не привязана к Telegram.
 * Если считать её «уже в зале», заявка не создаётся, тренер её не видит и клиент застревает
 * на экране «Заявка ушла». Заявку создаём; привязку по юзернейму делает одобрение (decideJoin).
 */
export function isInHall(clients: ReadonlyArray<{ telegramId?: string | null }>, userId: string | number): boolean {
  const id = String(userId ?? "").trim();
  if (!id) return false;
  return clients.some((c) => String(c.telegramId ?? "").trim() === id);
}
