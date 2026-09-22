import {
  addDays,
  DOW,
  DOW_LONG,
  isoDate,
  isFrozen,
  isSlotPast,
  MEALS,
  MONTHS,
  MARIA_SESSIONS,
  PACK_VALID_DAYS,
  packDaysLeft,
  parseISODate,
  SATURDAY_TIMES,
  sessionsRu,
  startOfWeek,
  STUDIO,
  WEEKDAY_TIMES,
  type Booking,
  type Client,
  type FoodLog,
  type Kbju,
  type LiftLog,
  type Meal,
  type Notice,
  type ProgramSession,
  type Slot,
  type WeightPoint,
} from "./studio";

export function bookingIcs(booking: { date: string; time: string; duration: number }, title = "Тренировка · Ruksha") {
  const [h, m] = booking.time.split(":").map(Number);
  const start = parseISODate(booking.date);
  start.setHours(h || 0, m || 0, 0, 0);
  const end = new Date(start.getTime() + booking.duration * 60000);
  const stamp = (d: Date) => {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
  };
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ruksha Discipline//RU",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${STUDIO.brand}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function firstBookableDate() {
  const from = startOfWeek(new Date());
  const next = generateWindow(from, 14).find((s) => !isSlotPast(s.date, s.time));
  return next?.date ?? isoDate(new Date());
}

function capacityFor(time: string) {
  return time >= "16:00" ? 3 : 2;
}

export function generateWindow(from: Date, days = 21): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = addDays(from, i);
    const dow = (day.getDay() + 6) % 7;
    const times = dow === 6 ? [] : dow === 5 ? SATURDAY_TIMES : WEEKDAY_TIMES;
    for (const time of times) {
      const date = isoDate(day);
      const id = `${date}_${time}`;
      const capacity = capacityFor(time);
      slots.push({ id, date, time, duration: 60, capacity, seeded: 0 });
    }
  }
  return slots;
}

export function formatLongDate(iso: string) {
  const d = parseISODate(iso);
  const dow = DOW[(d.getDay() + 6) % 7];
  return `${dow}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatWeekdayLong(iso: string) {
  const d = parseISODate(iso);
  return `${DOW_LONG[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDayMonth(iso: string) {
  const d = parseISODate(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function placesLeft(n: number) {
  if (n === 1) return "1 место";
  if (n >= 2 && n <= 4) return `${n} места`;
  return `${n} мест`;
}

export function dowIndex(iso: string) {
  return (parseISODate(iso).getDay() + 6) % 7;
}

export function isTrainDay(client: Client, iso: string, bookings: Booking[] = []) {
  return bookings.some((b) => b.clientId === client.id && b.date === iso) || client.trainDays.includes(dowIndex(iso));
}

export function dayKbju(client: Client, iso: string, bookings: Booking[] = []): { kbju: Kbju; train: boolean } {
  const train = isTrainDay(client, iso, bookings);
  if (train) return { kbju: client.kbju, train: true };
  return { kbju: client.kbjuRest?.calories ? client.kbjuRest : client.kbju, train: false };
}

export function initials(client: Pick<Client, "firstName" | "lastName">) {
  const a = client.firstName.trim().charAt(0);
  const b = client.lastName.trim().charAt(0);
  return `${a}${b}`.toUpperCase();
}

export function daysRu(n: number) {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "дня";
  return "дней";
}

export function daysAgoPhrase(n: number) {
  if (n <= 0) return "сегодня";
  if (n === 1) return "вчера";
  return `${n} ${daysRu(n)} назад`;
}

export function shortName(client: Pick<Client, "firstName" | "lastName">) {
  return `${client.firstName} ${client.lastName.charAt(0)}.`;
}

export function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 3600000).toISOString();
}

export function relativeLabel(iso: string) {
  const t = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).getTime();
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 60) return `${Math.max(1, min)} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d === 1) return "вчера";
  return `${d} ${daysRu(d)} назад`;
}

export function daysSince(iso: string | null, from = isoDate(new Date())) {
  if (!iso) return 99;
  const a = parseISODate(iso.slice(0, 10));
  const b = parseISODate(from);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

export function emptyKbju(): Kbju {
  return { calories: 0, protein: 0, fat: 0, carbs: 0 };
}

export function sumFood(entries: FoodLog[]): Kbju {
  return entries.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      fat: acc.fat + f.fat,
      carbs: acc.carbs + f.carbs,
    }),
    emptyKbju(),
  );
}

export function weightDelta(history: WeightPoint[]) {
  if (history.length < 2) return 0;
  const first = history[0].kg;
  const last = history[history.length - 1].kg;
  return Math.round((last - first) * 10) / 10;
}

function historyFrom(kg: number, deltas: number[]): WeightPoint[] {
  return deltas.map((d, i) => ({
    date: isoDate(addDays(new Date(), i - (deltas.length - 1))),
    kg: Math.round((kg + d) * 10) / 10,
  }));
}

/** First actual visit this week = Day A, even if that weekday is Thursday. */
export function visitSession(client: Client, iso: string, bookings: Booking[] = []): ProgramSession | null {
  if (!client.sessions.length) return null;
  const week = startOfWeek(parseISODate(iso));
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(week, i)));
  const booked = new Set(
    bookings.filter((b) => b.clientId === client.id && weekDates.includes(b.date)).map((b) => b.date),
  );
  const train = client.trainDays.includes(dowIndex(iso));
  const isVisit = booked.has(iso) || train;
  if (!isVisit) return null;

  const sequence = booked.size
    ? weekDates.filter((d) => booked.has(d) || d === iso)
    : weekDates.filter((d) => client.trainDays.includes(dowIndex(d)));
  const idx = sequence.indexOf(iso);
  if (idx < 0) return null;
  return client.sessions[idx % client.sessions.length];
}

export function programWeek(client: Client, iso: string) {
  const start = parseISODate(client.programStart);
  const d = parseISODate(iso);
  const diff = Math.floor((d.getTime() - start.getTime()) / 86400000);
  const w = Math.floor(diff / 7) + 1;
  return Math.min(client.programWeeks, Math.max(1, w));
}

export function nextTrainDate(client: Client, from = new Date()) {
  for (let i = 0; i < 14; i += 1) {
    const d = addDays(from, i);
    const dow = (d.getDay() + 6) % 7;
    if (client.trainDays.includes(dow)) return isoDate(d);
  }
  return isoDate(from);
}

export function emptyClient(): Client {
  const today = isoDate(new Date());
  return {
    id: `c_${Date.now()}`,
    firstName: "",
    lastName: "",
    weight: 0,
    kbju: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    kbjuRest: { calories: 0, protein: 0, fat: 0, carbs: 0 },
    programTitle: "",
    programWeeks: 8,
    programStart: today,
    sessions: [],
    trainDays: [],
    trainTimes: [],
    lastReportAt: null,
    streak: 0,
    weightHistory: [],
    lateCancels: 0,
    sessionsLeft: 0,
    ledger: [],
    frozenUntil: null,
    packExpiresAt: null,
    telegramId: null,
    telegramUsername: null,
  };
}

export const SEED_CLIENTS: Client[] = [];

export function seedFood(): FoodLog[] {
  return [];
}

export function seedBookings(): Booking[] {
  return [];
}

export function seedNotices(): Notice[] {
  return [];
}

export const SEED_LIFTS: LiftLog[] = [];

export type ClientFlag = {
  attention: boolean;
  today: boolean;
  badge: string | null;
  tone: "alert" | "ok" | "none";
  daysSinceReport: number;
  eaten: Kbju;
};

export function clientFlag(
  client: Client,
  today: string,
  food: FoodLog[],
  bookings: Booking[],
): ClientFlag {
  const daysSinceReport = daysSince(client.lastReportAt, today);
  const eaten = sumFood(food.filter((f) => f.date === today && f.clientId === client.id));
  const target = dayKbju(client, today, bookings).kbju;
  const lowCal = eaten.calories > 0 && target.calories > 0 && eaten.calories < target.calories * 0.72;
  const noReport = daysSinceReport >= 3;
  const lateOften = (client.lateCancels ?? 0) >= 2;
  const lowPack = (client.sessionsLeft ?? 0) <= 2;
  const frozen = isFrozen(client, today);
  const expiring = packDaysLeft(client, today);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const todayTrain = client.trainDays.includes(dowIndex(today));
  const todayOn = Boolean(todayBook || todayTrain);
  const attention = noReport || lowCal || lateOften || lowPack || frozen || (expiring !== null && expiring <= 7);
  let badge: string | null = null;
  let tone: ClientFlag["tone"] = "none";
  if (frozen) {
    badge = `заморозка до ${formatDayMonth(client.frozenUntil!)}`;
    tone = "alert";
  } else if (noReport) {
    badge = `нет отчёта ${daysSinceReport} ${daysRu(daysSinceReport)}`;
    tone = "alert";
  } else if (lateOften) {
    badge = "поздние отмены";
    tone = "alert";
  } else if (lowPack) {
    badge = `осталось ${client.sessionsLeft} ${sessionsRu(client.sessionsLeft)}`;
    tone = "alert";
  } else if (expiring !== null && expiring <= 7) {
    badge = expiring <= 0 ? "пакет истёк" : `пакет ${expiring} ${daysRu(expiring)}`;
    tone = "alert";
  } else if (lowCal) {
    badge = "недобор калорий";
    tone = "alert";
  } else if (todayBook) {
    badge = `сегодня ${todayBook.time}`;
    tone = "ok";
  } else if (todayTrain && client.trainTimes[0]) {
    badge = `сегодня ${client.trainTimes[0]}`;
    tone = "ok";
  }
  return { attention, today: todayOn, badge, tone, daysSinceReport, eaten };
}
