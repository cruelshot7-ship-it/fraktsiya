/**
 * Уведомления о доступе тренера: пробный период и оплата заканчиваются, доступ на паузе или истёк.
 * Чистая логика: что пора сказать, как не повторять, какие сигналы попадут тренеру-владельцу.
 * Отправку в бот и запись делает studio-sync; здесь только решение.
 */
import { COACH_TRIAL_DAYS, coachPhase, type Coach, type Notice } from "@/data/studio";

const DAY = 86_400_000;

export type CoachNoticeKey = "trial_soon" | "paid_soon" | "paused" | "expired";

export type CoachNotice = {
  telegramId: string;
  name: string;
  key: CoachNoticeKey;
  daysLeft: number;
  /** ключ для lastNotice: вид уведомления и его «период» (дата старта или оплаты), чтобы не повторять */
  stamp: string;
};

/** За сколько дней до конца предупреждать. */
export const COACH_WARN_DAYS = 2;

function nameOf(c: Coach) {
  return [c.firstName, c.lastName].filter(Boolean).join(" ") || (c.username ? `@${c.username}` : "тренер");
}

/** Что сейчас пора сказать тренерам, у которых есть Telegram. Пустой список — ничего нового. */
export function dueCoachNotices(coaches: Coach[], now: number): CoachNotice[] {
  const out: CoachNotice[] = [];
  for (const c of coaches) {
    if (!c.telegramId) continue;
    const phase = coachPhase(c, now);
    const name = nameOf(c);
    if (phase === "paid") {
      const paid = Date.parse(c.paidUntil ?? "");
      const daysLeft = Math.max(0, Math.ceil((paid - now) / DAY));
      if (daysLeft <= COACH_WARN_DAYS) out.push({ telegramId: c.telegramId, name, key: "paid_soon", daysLeft, stamp: c.paidUntil ?? "" });
    } else if (phase === "trial") {
      const start = c.addedAt ? Date.parse(c.addedAt) : now;
      const daysLeft = Math.max(0, Math.ceil((start + COACH_TRIAL_DAYS * DAY - now) / DAY));
      if (daysLeft <= COACH_WARN_DAYS) out.push({ telegramId: c.telegramId, name, key: "trial_soon", daysLeft, stamp: c.addedAt ?? "" });
    } else if (phase === "paused") {
      out.push({ telegramId: c.telegramId, name, key: "paused", daysLeft: 0, stamp: c.addedAt ?? "" });
    } else {
      out.push({ telegramId: c.telegramId, name, key: "expired", daysLeft: 0, stamp: c.addedAt ?? "" });
    }
  }
  return out.filter((n) => {
    const row = coaches.find((c) => c.telegramId === n.telegramId);
    return row?.lastNotice !== `${n.key}:${n.stamp}`;
  });
}

/** Текст сообщения тренеру. Без обещаний оплаты: продлевает доступ тренер-владелец. */
export function coachNoticeText(n: CoachNotice): string {
  switch (n.key) {
    case "trial_soon":
      return `Пробный доступ заканчивается через ${n.daysLeft} дн. Попросите тренера продлить доступ, иначе новые клиенты и записи закроются.`;
    case "paid_soon":
      return `Оплаченный доступ заканчивается через ${n.daysLeft} дн. Попросите тренера продлить его заранее.`;
    case "paused":
      return "Доступ на паузе: новые клиенты и записи закрыты, данные сохраняются ограниченное время. Попросите тренера продлить доступ.";
    case "expired":
      return "Доступ закончился. Попросите тренера продлить его, чтобы вернуть работу с клиентами.";
  }
}

/** Текст сигнала владельцу: он сам продлевает доступ тренера, поэтому обращение к нему. */
export function ownerNoticeText(n: CoachNotice): string {
  switch (n.key) {
    case "trial_soon":
      return `Пробный доступ тренера ${n.name} закончится через ${n.daysLeft} дн. Продлите его, иначе новые клиенты и записи закроются.`;
    case "paid_soon":
      return `Оплаченный доступ тренера ${n.name} закончится через ${n.daysLeft} дн. Продлите его заранее.`;
    case "paused":
      return `Доступ тренера ${n.name} на паузе: новые клиенты и записи закрыты. Продлите доступ, чтобы вернуть работу.`;
    case "expired":
      return `Доступ тренера ${n.name} закончился. Продлите его, чтобы вернуть работу с клиентами.`;
  }
}

/**
 * Применяет уведомления к состоянию: помечает тренеров (lastNotice) и добавляет сигнал владельцу.
 * Возвращает null, если нового нет. Вызывается внутри записи с повтором, поэтому повторный вызов ничего не меняет.
 */
export function applyCoachNotices<T extends { coaches?: Coach[]; notices: Notice[] }>(
  payload: T,
  now: number,
): { next: T; due: CoachNotice[] } | null {
  const due = dueCoachNotices(payload.coaches ?? [], now);
  if (!due.length) return null;
  const marks = new Map(due.map((n) => [n.telegramId, `${n.key}:${n.stamp}`]));
  const at = new Date(now).toISOString();
  const owner: Notice[] = due.map((n) => ({
    id: `nt_coach_${n.telegramId}_${n.key}_${now}`,
    audience: "trainer",
    clientId: "",
    kind: "alert",
    title: `Доступ тренера ${n.name}: ${n.key === "expired" ? "закончился" : n.key === "paused" ? "на паузе" : `осталось ${n.daysLeft} дн.`}`,
    body: ownerNoticeText(n),
    at,
  }));
  return {
    next: {
      ...payload,
      coaches: (payload.coaches ?? []).map((c) =>
        c.telegramId && marks.has(c.telegramId) ? { ...c, lastNotice: marks.get(c.telegramId) } : c,
      ),
      notices: [...owner, ...payload.notices],
    },
    due,
  };
}
