import { TRAINER_TG_ID, clientCoach, shortName, type Booking, type Client, type FoodLog, type Visit } from "../data/studio.ts";
import { daysSinceVisit } from "./studio-visits.ts";

export function morningSummary(input: {
  clients: Client[];
  bookings: Booking[];
  visits?: Visit[];
  food: FoodLog[];
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
  return lines.join("\n");
}
