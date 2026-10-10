/** The question before a join request is declined. Declining is final for this request. */
export function joinRejectText(req: { firstName: string; lastName: string }): string {
  const who = `${req.firstName} ${req.lastName}`.trim();
  return `Отклонить заявку от ${who}? Клиент сможет подать её снова.`;
}

/**
 * The question the trainer answers before a join request becomes a client. The name and the
 * @handle come from the requester's own Telegram profile, so the trainer checks it is the same person.
 */
export function joinConfirmText(req: { firstName: string; lastName: string; telegramUsername?: string | null }): string {
  const who = `${req.firstName} ${req.lastName}`.trim();
  const handle = req.telegramUsername ? ` (@${req.telegramUsername.replace(/^@/, "")})` : "";
  return `Принять ${who}${handle} в зал? Проверьте, что это тот же человек.`;
}
