/**
 * Вход гостя-клиента в зал.
 * Пока сервер не ответил, не знаем, есть ли у Telegram-пользователя клиент.
 * Поэтому до ответа ни лендинг, ни запись показывать нельзя: иначе существующий клиент
 * видит лендинг, а потом его уводит на запись.
 */
export type InviteGate = { inviteBlocked: boolean; inviteChecked: boolean };

export function initialInviteGate(input: { telegramUser: boolean; trainer: boolean }): InviteGate {
  if (!input.telegramUser || input.trainer) return { inviteBlocked: false, inviteChecked: true };
  return { inviteBlocked: true, inviteChecked: false };
}

/** Ответ сервера: лендинг только если сервер подтвердил «клиента нет» и локально клиентов тоже нет. */
export function resolvedInviteGate(input: { blocked: boolean | undefined; clientCount: number }): InviteGate {
  return { inviteBlocked: Boolean(input.blocked) && input.clientCount === 0, inviteChecked: true };
}
