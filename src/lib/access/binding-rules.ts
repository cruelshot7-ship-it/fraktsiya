/**
 * Правила доступа без серверных импортов: их можно проверять тестами без базы и Telegram.
 *
 * Идентичность — только numeric Telegram id. Handle (@username) меняется и может
 * перейти к другому человеку, поэтому по нему никого не привязываем, кроме одного
 * случая: строка тренера, у которой telegramId ещё пуст, может быть занята первым
 * пришедшим с таким handle. Это остаётся решением владельца (см. PLAN, T-03).
 */
import { TRAINER_TG_ID, clientCoach, coachPhase, type Coach } from "../../data/studio.ts";

export type TgUser = { id: string; username: string | null; firstName?: string; lastName?: string };

type Client = { id: string; telegramId?: string | null; coachId?: string | null };
type Visit = { clientId: string };
type Payload = { coaches?: Coach[]; clients: Client[]; visits?: Visit[] };

export function normHandle(value: string | null | undefined): string {
  return (value ?? "").replace(/^@/, "").trim().toLowerCase();
}

/**
 * Привязка строки тренера.
 * - Если telegramId уже совпадает с пользователем — только дозаполнить имя.
 * - Чужой telegramId никогда не перезаписывается.
 * - Строка без telegramId занимается по handle (первый пришедший).
 */
export function bindCoachRule<T extends Payload>(payload: T, user: TgUser): T {
  const coaches = payload.coaches ?? [];
  const own = coaches.findIndex((c) => c.telegramId === user.id);
  if (own >= 0) {
    const row = coaches[own];
    if (row.firstName) return payload;
    const next = coaches.slice();
    next[own] = { ...row, firstName: user.firstName ?? "", lastName: row.lastName || user.lastName || "" };
    return { ...payload, coaches: next };
  }
  const handle = normHandle(user.username);
  if (!handle) return payload;
  const idx = coaches.findIndex((c) => !c.telegramId && normHandle(c.username) === handle);
  if (idx < 0) return payload;
  const row = coaches[idx];
  const next = coaches.slice();
  next[idx] = {
    ...row,
    telegramId: user.id,
    username: user.username ?? row.username,
    firstName: row.firstName || user.firstName || "",
    lastName: row.lastName || user.lastName || "",
  };
  return { ...payload, coaches: next };
}

/** Тренер (главный или добавленный с активным доступом; на паузе — вход есть, но без записи). */
export function isCoachUserRule(payload: Payload, user: TgUser): boolean {
  if (user.id === String(TRAINER_TG_ID)) return true;
  const row = (payload.coaches ?? []).find((c) => c.telegramId === user.id);
  if (!row) return false;
  const phase = coachPhase(row);
  return phase === "trial" || phase === "paid" || phase === "paused";
}

/**
 * Кому можно отправить сообщение через бота.
 * Главный тренер — только своим клиентам и тренерам. Другой тренер — только своим клиентам,
 * и только если доступ не на паузе. Произвольный telegramId запрещён.
 */
export function canSendBotLinkRule(payload: Payload, user: TgUser, telegramId: string, now = Date.now()): boolean {
  if (!isCoachUserRule(payload, user)) return false;
  const target = String(telegramId ?? "").trim();
  if (!/^\d{1,20}$/.test(target)) return false;
  const isTrainer = user.id === String(TRAINER_TG_ID);
  if (!isTrainer) {
    const row = (payload.coaches ?? []).find((c) => c.telegramId === user.id);
    if (!row) return false;
    const phase = coachPhase(row, now);
    if (phase !== "trial" && phase !== "paid") return false;
  }
  return payload.clients.some(
    (c) => c.telegramId === target && (isTrainer || clientCoach(c) === user.id),
  );
}

/** Визиты только клиентов, видимых тренеру. */
export function visitsForClients<V extends Visit>(visits: V[] | undefined, clientIds: Set<string>): V[] {
  return (visits ?? []).filter((v) => clientIds.has(v.clientId));
}
