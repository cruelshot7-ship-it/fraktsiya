export const TRAINER_TG_ID = "8144320404";

export const STUDIO = {
  name: "Ruksha",
  brand: "RUKSHA DISCIPLINE",
  line: "Discipline",
  est: "Est. 2026",
  city: "Минск",
  trainer: "Евгений",
};


export const DOW = ["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"] as const;
export const DOW_LONG = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;
export const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
] as const;

export const WEEKDAY_TIMES = ["07:00", "07:30", "08:00", "08:30", "09:00", "16:30", "19:00"];
export const SATURDAY_TIMES: string[] = [];

export type Meal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export const MEALS: Meal[] = [
  { id: "oats", name: "Овсянка с яйцом", calories: 420, protein: 24, fat: 14, carbs: 48 },
  { id: "bowl", name: "Боул с курицей", calories: 610, protein: 48, fat: 18, carbs: 52 },
  { id: "salmon", name: "Лосось и рис", calories: 680, protein: 42, fat: 28, carbs: 54 },
  { id: "salad", name: "Тёплый салат", calories: 380, protein: 32, fat: 16, carbs: 22 },
  { id: "shake", name: "Протеин-шейк", calories: 240, protein: 32, fat: 4, carbs: 18 },
  { id: "omelette", name: "Омлет и тост", calories: 450, protein: 28, fat: 26, carbs: 24 },
  { id: "beef", name: "Говядина и гречка", calories: 720, protein: 52, fat: 22, carbs: 64 },
  { id: "yogurt", name: "Творог с ягодами", calories: 290, protein: 26, fat: 8, carbs: 28 },
];

/** Local barcode pack so scan works without the camera and if Open Food Facts is down. Per 100 g. */
export const BARCODE_CATALOG: Record<string, Omit<ScanProduct, "source" | "barcode">> = {
  "3017620422003": {
    name: "Nutella",
    brand: "Ferrero",
    per100: { calories: 539, protein: 6.3, fat: 30.9, carbs: 57.5 },
  },
  "5449000000996": {
    name: "Coca-Cola",
    brand: "Coca-Cola",
    per100: { calories: 42, protein: 0, fat: 0, carbs: 10.6 },
  },
  "4600690101081": {
    name: "Молоко 2,5%",
    brand: "Простоквашино",
    per100: { calories: 53, protein: 2.8, fat: 2.5, carbs: 4.7 },
  },
  "4810168030018": {
    name: "Творог 5%",
    brand: "Савушкин",
    per100: { calories: 121, protein: 17, fat: 5, carbs: 1.8 },
  },
  "4607065001553": {
    name: "Гречка ядрица",
    brand: "Мистраль",
    per100: { calories: 334, protein: 12.6, fat: 3.3, carbs: 62 },
  },
  "4600690102555": {
    name: "Кефир 2,5%",
    brand: "Простоквашино",
    per100: { calories: 53, protein: 2.9, fat: 2.5, carbs: 4 },
  },
  "2000000000012": {
    name: "Протеин-шейк студии",
    brand: "Ruksha",
    per100: { calories: 80, protein: 10.7, fat: 1.3, carbs: 6 },
  },
};

export const DEMO_BARCODES: { code: string; label: string }[] = [
  { code: "4810168030018", label: "Творог" },
  { code: "4600690101081", label: "Молоко" },
  { code: "3017620422003", label: "Nutella" },
  { code: "2000000000012", label: "Шейк зала" },
];

export const EXERCISES = ["жим", "присед", "тяга", "подтягивания", "армейский"] as const;

export const MET: Record<string, number> = {
  бег: 9.8,
  ходьба: 3.5,
  велосипед: 7.5,
  плавание: 8.0,
  силовая: 6.0,
  йога: 2.5,
};

export type Slot = {
  id: string;
  date: string;
  time: string;
  duration: number;
  capacity: number;
  seeded: number;
};

export type Booking = {
  id: string;
  slotId: string;
  clientId: string;
  date: string;
  time: string;
  duration: number;
  held?: boolean;
  checkedIn?: boolean;
  noShow?: boolean;
};

export type SessionTxn = {
  id: string;
  clientId: string;
  kind: "credit" | "hold" | "refund" | "burn" | "adjust";
  delta: number;
  at: string;
  note: string;
  bookingId?: string;
};

export type WaitlistEntry = {
  id: string;
  slotId: string;
  clientId: string;
  at: string;
};

export const PACKS = [4, 8, 12] as const;
export const WEEK_GOAL = 3;
export const PACK_VALID_DAYS = 60;
export const FREEZE_OPTIONS = [7, 14, 30] as const;

export type FoodLog = Meal & { logId: string; date: string; clientId: string };

export type LiftLog = {
  id: string;
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  clientId: string;
};

export type WorkoutLog = {
  id: string;
  clientId: string;
  date: string;
  minutes: number;
  kcal: number;
  done: number;
  total: number;
  at: string;
};

export type ScanProduct = {
  barcode: string;
  name: string;
  brand?: string;
  per100: Kbju;
  source: "local" | "off" | "cache" | "studio";
  quantity?: string;
  servingGrams?: number;
  incomplete?: boolean;
  stale?: boolean;
  image?: string;
};

export type Kbju = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type ProgramSession = {
  id: string;
  name: string;
  focus: string;
  items: string[];
};

export type WeightPoint = {
  date: string;
  kg: number;
};

export type Notice = {
  id: string;
  audience: "trainer" | "client";
  clientId: string;
  kind: "cancel" | "reschedule" | "book" | "alert" | "photo" | "food" | "wallet" | "waitlist" | "checkin" | "freeze" | "noshow";
  title: string;
  body: string;
  at: string;
  late?: boolean;
  slotId?: string;
};

export type NotifyPrefs = {
  windowHours: number;
  notifyClient: boolean;
  notifyTrainer: boolean;
  flagLate: boolean;
};

export const DEFAULT_NOTIFY: NotifyPrefs = {
  windowHours: 2,
  notifyClient: true,
  notifyTrainer: true,
  flagLate: true,
};

export const CANCEL_WINDOWS = [2, 6, 12, 24] as const;

export type Client = {
  id: string;
  firstName: string;
  lastName: string;
  weight: number;
  kbju: Kbju;
  programTitle: string;
  programWeeks: number;
  programStart: string;
  sessions: ProgramSession[];
  trainDays: number[];
  trainTimes: string[];
  lastReportAt: string | null;
  streak: number;
  weightHistory: WeightPoint[];
  lateCancels?: number;
  sessionsLeft: number;
  ledger: SessionTxn[];
  frozenUntil?: string | null;
  packExpiresAt?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
};

export type MachineEx = {
  name: string;
  path: "press" | "squat" | "row";
  cues: string[];
  mistakes: string[];
};

export type Machine = {
  id: string;
  name: string;
  zone: string;
  hint: string;
  exercises: MachineEx[];
};

export const MACHINES: Machine[] = [
  {
    id: "bench",
    name: "Скамья для жима",
    zone: "Жимовая",
    hint: "Наведите камеру на гриф и стойки — в зале так и будет.",
    exercises: [
      {
        name: "Жим лёжа",
        path: "press",
        cues: ["Лопатки собраны, грудь вверх", "Гриф на нижнюю часть груди", "Локти ~45°, стопы в пол"],
        mistakes: ["Отрыв таза", "Гриф гуляет по дуге к лицу"],
      },
      {
        name: "Жим гантелей",
        path: "press",
        cues: ["Нейтральный запястный угол", "Опускайте до растяжения груди"],
        mistakes: ["Стучать гантелями вверху", "Прогиб только в пояснице"],
      },
    ],
  },
  {
    id: "rack",
    name: "Силовая рама",
    zone: "Низ",
    hint: "Рама, зеркало, ограничители — сканер узнает стойку.",
    exercises: [
      {
        name: "Присед со штангой",
        path: "squat",
        cues: ["Колени по носкам", "Таз между пятками", "Вставайте грудью, не лбом"],
        mistakes: ["Колени заваливаются внутрь", "Пятки отрываются"],
      },
      {
        name: "Жим стоя",
        path: "press",
        cues: ["Пресс и ягодицы в тонусе", "Гриф почти по лицу вверх"],
        mistakes: ["Прогиб как мостик", "Дожимать плечами к ушам"],
      },
    ],
  },
  {
    id: "cable",
    name: "Блочный тренажёр",
    zone: "Тяги",
    hint: "Башня, рукоять, трос — типичный кроссовер.",
    exercises: [
      {
        name: "Тяга верхнего блока",
        path: "row",
        cues: ["Грудь к ручке, локти вниз-назад", "Не заваливайте корпус"],
        mistakes: ["Тянуть руками, а не спиной", "Рывок всем телом"],
      },
      {
        name: "Тяга к поясу",
        path: "row",
        cues: ["Лопатка к позвоночнику", "Пауза в пике"],
        mistakes: ["Круглая поясница", "Короткий ход"],
      },
    ],
  },
  {
    id: "legpress",
    name: "Жим ногами",
    zone: "Низ",
    hint: "Салазки и платформа под углом.",
    exercises: [
      {
        name: "Жим платформы",
        path: "squat",
        cues: ["Полная стопа", "Не отрывать поясницу от спинки", "Контроль вниз"],
        mistakes: ["Колени внутрь", "Замок коленей ударом"],
      },
    ],
  },
  {
    id: "hyperext",
    name: "Гиперэкстензия",
    zone: "Задняя цепь",
    hint: "Римский стул / наклонная скамья.",
    exercises: [
      {
        name: "Разгибание корпуса",
        path: "squat",
        cues: ["Нейтральная шея", "Движение в бёдрах, не в пояснице", "Вверху не забрасывать"],
        mistakes: ["Переразгиб как мостик", "Рывок с руками"],
      },
    ],
  },
  {
    id: "lat",
    name: "Турник / гравитрон",
    zone: "Верх · тяга",
    hint: "Перекладина над головой.",
    exercises: [
      {
        name: "Подтягивания",
        path: "row",
        cues: ["Лопатки вниз до сгиба рук", "Грудь к перекладине"],
        mistakes: ["Качание корпусом", "Недожим вверху"],
      },
    ],
  },
];

export const MARIA_SESSIONS: ProgramSession[] = [
  { id: "a", name: "День A", focus: "Ноги + ягодицы", items: ["Присед 4×6", "Румынская 3×8", "Выпады 3×10", "Ягодичный мост 3×12"] },
  { id: "b", name: "День B", focus: "Верх · жим", items: ["Жим лёжа 4×6", "Жим гантелей 3×10", "Тяга блока 4×8", "Лицо-тяги 3×15"] },
  { id: "c", name: "День C", focus: "Верх · тяга", items: ["Подтягивания 4×макс", "Тяга штанги 4×6", "Армейский жим 3×8", "Бицепс 3×12"] },
];

export function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function isoDate(d: Date) {
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
}

export function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function isPastDate(iso: string) {
  const today = isoDate(new Date());
  return iso < today;
}

export function nowHM() {
  const n = new Date();
  return `${pad(n.getHours())}:${pad(n.getMinutes())}`;
}

export function isSlotPast(date: string, time: string) {
  const today = isoDate(new Date());
  if (date < today) return true;
  if (date > today) return false;
  return time <= nowHM();
}

export function hoursUntilSlot(date: string, time: string) {
  const [h, m] = time.split(":").map(Number);
  const d = parseISODate(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return (d.getTime() - Date.now()) / 3600000;
}

export function isLateCancel(date: string, time: string, windowHours: number) {
  return hoursUntilSlot(date, time) < windowHours;
}

export function hoursRu(n: number) {
  const abs = Math.abs(Math.round(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "час";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "часа";
  return "часов";
}

export function hoursUntilLabel(hours: number) {
  if (hours < 1) return "меньше часа";
  const rounded = Math.round(hours);
  return `${rounded} ${hoursRu(rounded)}`;
}

export function sessionsRu(n: number) {
  const abs = Math.abs(Math.round(n));
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "занятие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "занятия";
  return "занятий";
}

export function isFrozen(client: Pick<Client, "frozenUntil">, today = isoDate(new Date())) {
  return Boolean(client.frozenUntil && client.frozenUntil >= today);
}

export function packDaysLeft(client: Pick<Client, "packExpiresAt">, today = isoDate(new Date())) {
  if (!client.packExpiresAt) return null;
  return Math.round((parseISODate(client.packExpiresAt).getTime() - parseISODate(today).getTime()) / 86400000);
}

export function countdownLabel(date: string, time: string) {
  const hours = hoursUntilSlot(date, time);
  if (hours < 0) return "уже началось";
  if (hours < 1) return `через ${Math.max(1, Math.round(hours * 60))} мин`;
  if (hours < 24) return `через ${Math.round(hours)} ${hoursRu(Math.round(hours))}`;
  const days = Math.floor(hours / 24);
  return `через ${days} дн`;
}

export function weekVisitCount(bookings: Booking[], clientId: string, from = new Date()) {
  const start = isoDate(startOfWeek(from));
  const end = isoDate(addDays(startOfWeek(from), 7));
  return bookings.filter((b) => b.clientId === clientId && b.date >= start && b.date < end).length;
}

export function scaleKbju(per100: Kbju, grams: number): Kbju {
  const k = Math.max(1, grams) / 100;
  const n = (v: number) => Math.round(v * k * 10) / 10;
  return {
    calories: Math.round(per100.calories * k),
    protein: n(per100.protein),
    fat: n(per100.fat),
    carbs: n(per100.carbs),
  };
}

/** Strength session: MET 6 × bodyweight × hours × how much of the plan was actually done. */
export function workoutKcal(weightKg: number, minutes: number, done: number, total: number) {
  const met = MET.силовая;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  const effort = 0.5 + 0.5 * ratio;
  const hours = Math.max(10, minutes) / 60;
  return Math.max(0, Math.round(met * weightKg * hours * effort));
}

export type Motive = { kicker: string; line: string };

export type MotiveCtx = {
  client: Client;
  today: string;
  trainDay: boolean;
  checkedIn: boolean;
  hoursToSession: number | null;
  foodCount: number;
  workout: WorkoutLog | null;
  checks: number;
  totalItems: number;
  frozen: boolean;
};

export function motiveFor(ctx: MotiveCtx): Motive {
  const { client, trainDay, checkedIn, hoursToSession, foodCount, workout, checks, totalItems, frozen } = ctx;
  if (frozen) {
    return { kicker: "Пауза", line: "Заморозка по правилам. Ритм не сломан — он стоит на паузе." };
  }
  if (workout) {
    return {
      kicker: "Смена закрыта",
      line: `${workout.kcal} ккал за работу. Дальше еда и сон — это тоже тренировка.`,
    };
  }
  if (checkedIn && checks === 0) {
    return { kicker: "Ты в зале", line: "Первый подход закрывает день. Не торгуйся с разминкой." };
  }
  if (checks > 0 && checks < totalItems) {
    return {
      kicker: "В работе",
      line: `Ещё ${totalItems - checks}. Не договаривайся с собой на «завтра доделаю».`,
    };
  }
  if (trainDay && hoursToSession !== null && hoursToSession > 0 && hoursToSession < 3) {
    return { kicker: "Скоро слот", line: "Через пару часов ты уже под грифом. Собери форму сейчас." };
  }
  if (trainDay && !checkedIn) {
    return { kicker: "День явки", line: "Слот стоит. Мотивация не нужна — нужна явка." };
  }
  if (!trainDay) {
    return { kicker: "Восстановление", line: "Сегодня не лень. Сегодня это заложено в программу." };
  }
  if (foodCount === 0) {
    return { kicker: "Дневник", line: "Один скан штрихкода — и день уже в плюсе. Курс держит дневник." };
  }
  if (client.streak >= 3) {
    return { kicker: `Серия ${client.streak}`, line: "Ритм уже держит тебя. Не геройство — явка." };
  }
  return { kicker: "Дисциплина", line: "Серия начинается с явки, не с настроения." };
}

export type DayRitual = {
  hall: boolean;
  food: boolean;
  report: boolean;
  restDay: boolean;
  done: number;
};

export function dayRitual(opts: {
  trainDay: boolean;
  checkedIn: boolean;
  workout: boolean;
  foodCount: number;
  reportedToday: boolean;
}): DayRitual {
  const restDay = !opts.trainDay;
  const hall = opts.checkedIn || opts.workout || restDay;
  const food = opts.foodCount > 0;
  const report = opts.reportedToday || food || opts.workout;
  return { hall, food, report, restDay, done: [hall, food, report].filter(Boolean).length };
}

export * from "./studio-tail";
