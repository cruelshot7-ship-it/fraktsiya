/**
 * Slot schedule rules shared by the app and the server. Pure, no imports.
 * The server uses the same capacity for a generated slot, so a client cannot
 * book past what the schedule allows by sending their own copy of the rule.
 */
export const WEEKDAY_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "16:30", "19:00"];
export const SATURDAY_TIMES: string[] = [];

/** Generated slots: 3 places from 16:00, otherwise 2. Trainer-made extra slots carry their own capacity. */
export function capacityFor(time: string): number {
  return time >= "16:00" ? 3 : 2;
}

/** Times the schedule generates for a date (Mon–Fri WEEKDAY_TIMES, Sat SATURDAY_TIMES, Sun none). ISO date in, UTC weekday, so the host timezone does not matter. */
export function generatedTimesFor(date: string): string[] {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return [];
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  if (dow === 6) return [];
  return dow === 5 ? SATURDAY_TIMES : WEEKDAY_TIMES;
}
