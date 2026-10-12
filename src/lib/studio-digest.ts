import { TRAINER_TG_ID, clientCoach, shortName, type Booking, type Client, type FoodLog, type Notice, type Visit } from "../data/studio.ts";
import { daysSinceVisit } from "./studio-visits.ts";

/** Уведомления о самочувствии — данные о здоровье. В личку не уходят: только в кабинете. */
export function isWellbeingNotice(n: Pick<Notice, "title">): boolean {
  return n.title.startsWith("Самочувствие");
}

/** Уведомления тренера за последние сутки, без данных о самочувствии. Новые сверху. */
export function trainerNoticeLines(notices: Notice[] | undefined, today: string, limit = 15): string[] {
  // начало сегодняшнего дня по Минску минус сутки
  const since = Date.parse(`${today}T00:00:00+03:00`) - 86_400_000;
  const rows = (notices ?? [])
    .filter((n) => n.audience === "trainer" && !isWellbeingNotice(n) && Date.parse(n.at) >= since)
    .sort((a, b) => b.at.localeCompare(a.at));
  const out = rows.slice(0, limit).map((n) => {
    const time = new Date(n.at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Minsk" });
    return `• ${time} ${n.title}`;
  });
  if (rows.length > limit) out.push(`…и ещё ${rows.length - limit}`);
  return out;
}

export function morningSummary(input: {
  clients: Client[];
  bookings: Booking[];
  visits?: Visit[];
  food: FoodLog[];
  notices?: Notice[];
  today: string;
  absentDays: number;
  coachId?: string;
}) {
  const coachId = input.coachId || String(TRAINER_TG_ID);
  const mine = input.clients.filter((client) => clientCoach(client) === coachId);
  const names = new Map(mine.map((client) => [client.id, shortName(client)]));
  const todayRows = input.bookings.filter((booking) => booking.date === input.today && names.has(booking.clientId));
  const yesterday = new Date(`${input.today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yday = yesterday.toISOString().slice(0, 10);
  const lines = [`Сводка · ${input.today}`, ""];
  lines.push(todayRows.length ? "Сегодня:" : "Сегодня записей нет.");
  for (const booking of todayRows) lines.push(`• ${names.get(booking.clientId)} · ${booking.time}`);
  const empty = mine.filter((client) => (client.sessionsLeft ?? 0) <= 0);
  if (empty.length) {
    lines.push("", "0 занятий:");
    for (const client of empty) lines.push(`• ${shortName(client)}`);
  }
  const hungry = todayRows.filter(
    (booking) => !input.food.some((row) => row.clientId === booking.clientId && (row.date === yday || row.date === input.today)),
  );
  if (hungry.length) {
    lines.push("", "Не сдали еду:");
    for (const booking of hungry) lines.push(`• ${names.get(booking.clientId)}`);
  }
  const quiet = mine.filter((client) => {
    const dates = [
      ...(input.visits ?? []).filter((row) => row.clientId === client.id).map((row) => row.date),
      ...input.bookings.filter((row) => row.clientId === client.id && row.checkedIn).map((row) => row.date),
    ];
    const gap = daysSinceVisit(dates, input.today);
    return gap === null || gap >= input.absentDays;
  });
  if (quiet.length) {
    lines.push("", `Нет визита ${input.absentDays}+ дней:`);
    for (const client of quiet) {
      const dates = [
        ...(input.visits ?? []).filter((row) => row.clientId === client.id).map((row) => row.date),
        ...input.bookings.filter((row) => row.clientId === client.id && row.checkedIn).map((row) => row.date),
      ];
      const gap = daysSinceVisit(dates, input.today);
      lines.push(`• ${shortName(client)}${gap === null ? " · визитов не было" : ` · ${gap} дн.`}`);
    }
  }
  const alerts = trainerNoticeLines(input.notices, input.today);
  if (alerts.length) {
    lines.push("", "Уведомления за сутки:");
    lines.push(...alerts);
  }
  return lines.join("\n");
}
