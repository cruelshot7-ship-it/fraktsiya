import {
  addDays,
  DOW,
  isoDate,
  isFrozen,
  isSlotPast,
  MEALS,
  MONTHS,
  MARIA_SESSIONS,
  packDaysLeft,
  parseISODate,
  SATURDAY_TIMES,
  sessionsRu,
  startOfWeek,
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
  return time >= "18:00" || time === "12:00" ? 3 : 2;
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
    firstName: "Новый",
    lastName: "клиент",
    weight: 70,
    kbju: { calories: 2200, protein: 150, fat: 65, carbs: 220 },
    programTitle: "База",
    programWeeks: 8,
    programStart: today,
    sessions: [{ id: "a", name: "День A", focus: "Полное тело", items: ["Присед 3×8", "Жим 3×8", "Тяга 3×8"] }],
    trainDays: [0, 2, 4],
    trainTimes: ["18:00"],
    lastReportAt: today,
    streak: 0,
    weightHistory: historyFrom(70, [0, 0, 0, 0, 0, 0, 0]),
    lateCancels: 0,
    sessionsLeft: 8,
    ledger: [],
    frozenUntil: null,
    packExpiresAt: isoDate(addDays(new Date(), PACK_VALID_DAYS)),
  };
}

export const SEED_CLIENTS: Client[] = [
  {
    id: "c_maria",
    firstName: "Мария",
    lastName: "Соколова",
    weight: 63.2,
    kbju: { calories: 1850, protein: 120, fat: 60, carbs: 200 },
    programTitle: "Ноги + ягодицы",
    programWeeks: 8,
    programStart: isoDate(addDays(new Date(), -35)),
    sessions: MARIA_SESSIONS,
    trainDays: [0, 2, 4],
    trainTimes: ["19:00"],
    lastReportAt: isoDate(addDays(new Date(), -4)),
    streak: 0,
    weightHistory: historyFrom(63.2, [0, -0.6, -0.9, -0.4, 0.2, 0.5, 0]),
    sessionsLeft: 6,
    ledger: [],
    packExpiresAt: isoDate(addDays(new Date(), 40)),
  },
  {
    id: "c_igor",
    firstName: "Игорь",
    lastName: "Петров",
    weight: 102,
    kbju: { calories: 2400, protein: 160, fat: 75, carbs: 270 },
    programTitle: "Full body",
    programWeeks: 8,
    programStart: isoDate(addDays(new Date(), -3)),
    sessions: [
      { id: "a", name: "Full body A", focus: "База", items: ["Присед 4×6", "Жим 4×6", "Тяга блока 4×8", "Планка 3×40с"] },
      { id: "b", name: "Full body B", focus: "Тяга", items: ["Становая 3×5", "Подтягивания 4×6", "Армейский 4×6"] },
    ],
    trainDays: [1, 3, 5],
    trainTimes: ["20:00"],
    lastReportAt: isoDate(addDays(new Date(), -2)),
    streak: 1,
    weightHistory: historyFrom(102, [0.4, 0.6, 0.3, 0.5, 0.1, -0.1, 0]),
    sessionsLeft: 10,
    ledger: [],
    packExpiresAt: isoDate(addDays(new Date(), 52)),
  },
  {
    id: "c_artem",
    firstName: "Артём",
    lastName: "Ким",
    weight: 79,
    kbju: { calories: 2600, protein: 180, fat: 75, carbs: 280 },
    programTitle: "Верх / низ",
    programWeeks: 10,
    programStart: isoDate(addDays(new Date(), -14)),
    sessions: [
      { id: "a", name: "Верх A", focus: "Жим", items: ["Жим 5×5", "Жим гантелей 3×10", "Тяга блока 4×8"] },
      { id: "b", name: "Низ B", focus: "Присед", items: ["Присед 5×5", "Румынская 3×8", "Икры 4×12"] },
    ],
    trainDays: [0, 2, 4],
    trainTimes: ["18:00"],
    lastReportAt: isoDate(new Date()),
    streak: 5,
    weightHistory: historyFrom(79, [-0.2, 0, 0.1, 0.2, 0.1, 0.3, 0]),
    sessionsLeft: 8,
    ledger: [],
    packExpiresAt: isoDate(addDays(new Date(), 48)),
  },
  {
    id: "c_dmitry",
    firstName: "Дмитрий",
    lastName: "Леонов",
    weight: 91.6,
    kbju: { calories: 3100, protein: 210, fat: 95, carbs: 370 },
    programTitle: "Сила 5×5",
    programWeeks: 12,
    programStart: isoDate(addDays(new Date(), -7)),
    sessions: [
      { id: "a", name: "Приседания", focus: "Низ", items: ["Присед 5×5", "Жим 5×5", "Подтягивания 3×8"] },
      { id: "b", name: "Становая", focus: "Тяга", items: ["Становая 5×5", "Армейский 5×5", "Тяга блока 4×8"] },
    ],
    trainDays: [0, 3],
    trainTimes: ["19:00"],
    lastReportAt: isoDate(addDays(new Date(), -1)),
    streak: 3,
    weightHistory: historyFrom(91.6, [-0.8, -0.6, -0.4, -0.2, 0.1, 0.4, 0]),
    sessionsLeft: 16,
    ledger: [],
    packExpiresAt: isoDate(addDays(new Date(), 55)),
  },
  {
    id: "c_olga",
    firstName: "Ольга",
    lastName: "Волкова",
    weight: 68.5,
    kbju: { calories: 1750, protein: 130, fat: 55, carbs: 180 },
    programTitle: "Рекомпозиция",
    programWeeks: 12,
    programStart: isoDate(addDays(new Date(), -49)),
    sessions: [
      { id: "a", name: "День A", focus: "Полное тело", items: ["Гоблет 3×8", "Жим гантелей 3×10", "Тяга 3×10"] },
      { id: "b", name: "День B", focus: "Полное тело", items: ["Румынская 3×8", "Жим стоя 3×8", "Выпады 3×8"] },
    ],
    trainDays: [1, 5],
    trainTimes: ["10:00"],
    lastReportAt: isoDate(new Date()),
    streak: 8,
    weightHistory: historyFrom(68.5, [0.4, 0.3, 0.1, 0.2, 0, -0.1, 0]),
    sessionsLeft: 5,
    ledger: [],
    packExpiresAt: isoDate(addDays(new Date(), 28)),
  },
  {
    id: "c_sveta",
    firstName: "Света",
    lastName: "Орлова",
    weight: 61,
    kbju: { calories: 2000, protein: 140, fat: 60, carbs: 200 },
    programTitle: "Вводный",
    programWeeks: 6,
    programStart: isoDate(addDays(new Date(), -10)),
    sessions: [
      { id: "a", name: "День A", focus: "Полное тело", items: ["Гоблет 3×8", "Жим гантелей 3×10", "Тяга блока 3×10", "Планка 3×30с"] },
      { id: "b", name: "День B", focus: "Полное тело", items: ["Румынская 3×8", "Жим стоя 3×8", "Выпады 3×8", "Лицо-тяги 3×12"] },
    ],
    trainDays: [3, 5],
    trainTimes: ["10:00", "18:00"],
    lastReportAt: isoDate(addDays(new Date(), -1)),
    streak: 2,
    weightHistory: historyFrom(61, [0.2, 0.1, 0, -0.1, 0.1, 0, 0]),
    sessionsLeft: 2,
    ledger: [],
    packExpiresAt: isoDate(addDays(new Date(), 6)),
  },
];

function foodEntry(
  clientId: string,
  date: string,
  meal: Meal,
  logId: string,
): FoodLog {
  return { ...meal, logId, date, clientId };
}

export function seedFood(): FoodLog[] {
  const today = isoDate(new Date());
  const yesterday = isoDate(addDays(new Date(), -1));
  return [
    foodEntry("c_igor", today, { id: "custom", name: "Каша, курица, рис", calories: 1400, protein: 95, fat: 40, carbs: 150 }, "f_igor_today"),
    foodEntry("c_igor", yesterday, { id: "custom", name: "День в дефиците", calories: 1380, protein: 90, fat: 38, carbs: 145 }, "f_igor_yest"),
    foodEntry("c_artem", today, { id: "custom", name: "Три приёма + шейк", calories: 2180, protein: 155, fat: 62, carbs: 230 }, "f_artem_today"),
    foodEntry("c_dmitry", today, { id: "custom", name: "Масса: 4 приёма", calories: 3050, protein: 205, fat: 95, carbs: 360 }, "f_dmitry_today"),
    foodEntry("c_olga", today, { id: "custom", name: "Завтрак и обед", calories: 1720, protein: 128, fat: 52, carbs: 175 }, "f_olga_today"),
    foodEntry("c_sveta", today, { id: "custom", name: "Боул и творог", calories: 1880, protein: 128, fat: 54, carbs: 190 }, "f_sveta_today"),
  ];
}

export function seedBookings(): Booking[] {
  const week = startOfWeek(new Date());
  const mk = (clientId: string, offset: number, time: string): Booking => {
    const date = isoDate(addDays(week, offset));
    return {
      id: `bk_seed_${clientId}_${date}_${time}`,
      slotId: `${date}_${time}`,
      clientId,
      date,
      time,
      duration: 60,
      held: true,
    };
  };
  return [
    mk("c_artem", 0, "18:00"),
    mk("c_dmitry", 0, "19:00"),
    mk("c_maria", 0, "19:00"),
    mk("c_igor", 1, "20:00"),
    mk("c_olga", 1, "10:00"),
    mk("c_maria", 2, "19:00"),
    mk("c_artem", 2, "18:00"),
    mk("c_dmitry", 2, "19:00"),
    mk("c_igor", 3, "20:00"),
    mk("c_sveta", 3, "18:00"),
    mk("c_dmitry", 3, "19:00"),
    mk("c_maria", 4, "19:00"),
    mk("c_artem", 4, "18:00"),
    mk("c_igor", 5, "11:00"),
    mk("c_olga", 5, "10:00"),
    mk("c_sveta", 5, "16:00"),
  ];
}

export function seedNotices(): Notice[] {
  return [
    {
      id: "sig_maria_report",
      audience: "trainer",
      clientId: "c_maria",
      kind: "alert",
      title: "Мария С. не отчитывается 4 дня",
      body: "Последний отчёт: 4 дня назад",
      at: hoursAgoIso(2),
    },
    {
      id: "sig_igor_cal",
      audience: "trainer",
      clientId: "c_igor",
      kind: "food",
      title: "Игорь П. недобирает калории",
      body: "1400 из 2400 ккал, второй день подряд",
      at: hoursAgoIso(3),
    },
    {
      id: "sig_dmitry_book",
      audience: "trainer",
      clientId: "c_dmitry",
      kind: "book",
      title: "Дмитрий Л. записался",
      body: `${formatLongDate(isoDate(startOfWeek(new Date())))}, 19:00`,
      at: hoursAgoIso(20),
    },
    {
      id: "sig_sveta_late",
      audience: "trainer",
      clientId: "c_sveta",
      kind: "cancel",
      late: true,
      slotId: "",
      title: "Света О. — поздняя отмена",
      body: "Суббота 16:00 · до слота меньше 12 ч. Клиенту ушло подтверждение.",
      at: hoursAgoIso(0.4),
    },
  ];
}

export const SEED_LIFTS: LiftLog[] = [
  { id: "l1", date: isoDate(addDays(new Date(), -21)), exercise: "жим", weight: 55, reps: 8, sets: 4, clientId: "c_maria" },
  { id: "l2", date: isoDate(addDays(new Date(), -14)), exercise: "жим", weight: 57.5, reps: 6, sets: 4, clientId: "c_maria" },
  { id: "l3", date: isoDate(addDays(new Date(), -7)), exercise: "жим", weight: 60, reps: 6, sets: 4, clientId: "c_maria" },
  { id: "l4", date: isoDate(addDays(new Date(), -18)), exercise: "присед", weight: 70, reps: 6, sets: 4, clientId: "c_maria" },
  { id: "l5", date: isoDate(addDays(new Date(), -11)), exercise: "присед", weight: 75, reps: 5, sets: 4, clientId: "c_maria" },
  { id: "l6", date: isoDate(addDays(new Date(), -4)), exercise: "присед", weight: 80, reps: 5, sets: 3, clientId: "c_maria" },
];

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
  const lowCal =
    eaten.calories > 0 && eaten.calories < client.kbju.calories * 0.72;
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
