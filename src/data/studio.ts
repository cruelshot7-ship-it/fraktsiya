export const TRAINER_TG_ID = "8144320404";

export type Coach = {
  telegramId: string | null;
  username: string | null;
  firstName: string;
  lastName: string;
  code?: string;
  addedAt?: string;
  paidUntil?: string | null;
};

export const COACH_PRICE_USD = 10;
export const COACH_TRIAL_DAYS = 7;
export const COACH_GRACE_DAYS = 7;
export const COACH_TRIAL_CAP = 15;
export const COACH_PAID_DAYS = 30;
const DAY_MS = 86_400_000;

export type CoachPhase = "trial" | "paid" | "paused" | "expired";

export function coachPhase(coach: { addedAt?: string | null; paidUntil?: string | null }, now = Date.now()): CoachPhase {
  const paid = coach.paidUntil ? Date.parse(coach.paidUntil) : 0;
  if (Number.isFinite(paid) && paid > now) return "paid";
  const start = coach.addedAt ? Date.parse(coach.addedAt) : now;
  const trialEnd = (Number.isFinite(start) ? start : now) + COACH_TRIAL_DAYS * DAY_MS;
  if (now < trialEnd) return "trial";
  if (now < trialEnd + COACH_GRACE_DAYS * DAY_MS) return "paused";
  return "expired";
}

export function coachStatusLine(coach: { addedAt?: string | null; paidUntil?: string | null }, now = Date.now()) {
  const phase = coachPhase(coach, now);
  const start = coach.addedAt && Number.isFinite(Date.parse(coach.addedAt)) ? Date.parse(coach.addedAt) : now;
  const trialEnd = start + COACH_TRIAL_DAYS * DAY_MS;
  const graceEnd = trialEnd + COACH_GRACE_DAYS * DAY_MS;
  const left = (until: number) => Math.max(1, Math.ceil((until - now) / DAY_MS));
  if (phase === "paid") return `Оплачено · ещё ${left(Date.parse(coach.paidUntil || ""))} дн. · $${COACH_PRICE_USD}/мес`;
  if (phase === "trial") return `Проба · ещё ${left(trialEnd)} дн. · до ${COACH_TRIAL_CAP} клиентов`;
  if (phase === "paused") return `Пауза · данные ещё ${left(graceEnd)} дн. · $${COACH_PRICE_USD}/мес`;
  return "Срок вышел. Кабинет закрыт, данные можно стереть.";
}

export function coachKey(id: string | null | undefined) {
  const value = String(id ?? "").trim();
  return value || TRAINER_TG_ID;
}

export function clientCoach(client: { coachId?: string | null }) {
  return coachKey(client.coachId);
}
export const INVITE_CODE = "erjoin";
export const BOT_USERNAME = "ruksha_discipline_bot";

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

export const SAMPLE_KBJU_TRAIN: Kbju = { calories: 1750, protein: 135, fat: 55, carbs: 180 };
export const SAMPLE_KBJU_REST: Kbju = { calories: 1600, protein: 135, fat: 55, carbs: 140 };

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
  startedAt?: string;
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
  kind: "cancel" | "reschedule" | "book" | "alert" | "photo" | "food" | "wallet" | "waitlist" | "checkin" | "freeze" | "noshow" | "join";
  title: string;
  body: string;
  at: string;
  late?: boolean;
  slotId?: string;
};

export type JoinRequest = {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string;
  lastName: string;
  message: string;
  at: string;
  status: "pending" | "approved" | "rejected";
  slotId?: string;
  goal?: string;
  pack?: string;
  coachId?: string | null;
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
  kbjuRest?: Kbju | null;
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
  phone?: string | null;
  coachId?: string | null;
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
    hint: "Гриф, стойки, скамья. Сначала выберите упражнение.",
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
    hint: "Рама и ограничители. Сначала выберите упражнение.",
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

export function machineFromScan(raw: string): Machine | null {
  const text = raw.trim();
  const fromUrl = /startapp=([^&\s#]+)/i.exec(text)?.[1];
  let token = fromUrl || text;
  try {
    token = decodeURIComponent(token);
  } catch {
    token = fromUrl || text;
  }
  const id = token.trim().toLowerCase().replace(/^m_/, "").replace(/^ruksha:/, "");
  return MACHINES.find((m) => m.id === id) ?? null;
}

const MARIA_SESSIONS: ProgramSession[] = [
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
  return `через ${days} ${daysRu(days)}`;
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

export type PlanBit = {
  kind: "scheme" | "weight" | "rest" | "text";
  sets: number;
  reps: number;
  kg: number | null;
  restSec: number;
};

export function readPlanLine(text: string): PlanBit {
  const raw = text.trim().toLowerCase().replace(/х/g, "x").replace(/×/g, "x").replace(/[–—]/g, "-");
  const rest = /отдых\s*(\d+)/.exec(raw);
  if (rest) return { kind: "rest", sets: 0, reps: 0, kg: null, restSec: Number(rest[1]) };
  const scheme = /(\d+)\s*x\s*(\d+)(?:\s*-\s*(\d+))?/.exec(raw);
  if (scheme) {
    const lo = Number(scheme[2]);
    const hi = scheme[3] ? Number(scheme[3]) : lo;
    const arms = /кажд/.test(raw) ? 2 : 1;
    return { kind: "scheme", sets: Number(scheme[1]) * arms, reps: Math.round((lo + hi) / 2), kg: null, restSec: 0 };
  }
  const weight = /(\d+(?:[.,]\d+)?)(?:\s*-\s*(\d+(?:[.,]\d+)?))?\s*кг/.exec(raw);
  if (weight) {
    const a = Number(weight[1].replace(",", "."));
    const b = weight[2] ? Number(weight[2].replace(",", ".")) : a;
    return { kind: "weight", sets: 0, reps: 0, kg: Math.round(((a + b) / 2) * 10) / 10, restSec: 0 };
  }
  return { kind: "text", sets: 0, reps: 0, kg: null, restSec: 0 };
}

export function lineGroup(items: string[], index: number): number[] {
  if (readPlanLine(items[index] ?? "").kind !== "text") return [index];
  if (readPlanLine(items[index + 1] ?? "").kind === "text") return [index];
  const group = [index];
  for (let i = index + 1; i < items.length; i += 1) {
    if (readPlanLine(items[i]).kind === "text") break;
    group.push(i);
  }
  return group.length > 1 ? group : [index];
}

export function planTotals(items: string[], checked: string[], facts: Record<number, string>) {
  let sets = 0;
  let reps = 0;
  let volume = 0;
  let restSec = 0;
  let pendingSets = 0;
  let pendingReps = 0;
  let pendingKg: number | null = null;
  const flush = () => {
    if (pendingSets > 0 && pendingKg != null && pendingReps > 0) {
      volume += pendingSets * pendingReps * pendingKg;
      sets += pendingSets;
      reps += pendingReps;
    }
    pendingSets = 0;
    pendingReps = 0;
    pendingKg = null;
  };
  items.forEach((item, index) => {
    if (!checked.includes(`${index}:${item}`)) return;
    const bit = readPlanLine(item);
    if (bit.kind === "text") flush();
    if (bit.kind === "scheme") {
      flush();
      pendingSets = bit.sets;
      pendingReps = bit.reps;
    }
    if (bit.kind === "weight") {
      const typed = Number((facts[index] ?? "").replace(",", "."));
      pendingKg = typed > 0 ? typed : bit.kg;
    }
    if (bit.kind === "rest") restSec += bit.restSec;
  });
  flush();
  return { sets, volume: Math.round(volume), restSec };
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

export function isTrainDay(client: Client, iso: string, bookings: Booking[] = []) {
  return bookings.some((b) => b.clientId === client.id && b.date === iso) || client.trainDays.includes(dowIndex(iso));
}

export function dayKbju(client: Client, iso: string, bookings: Booking[] = []): { kbju: Kbju; train: boolean } {
  const train = isTrainDay(client, iso, bookings);
  if (train) return { kbju: client.kbju, train: true };
  return { kbju: client.kbjuRest?.calories ? client.kbjuRest : client.kbju, train: false };
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

/** Visits follow the program in order: 1st booking = day 1, 2nd = day 2, then it repeats. */
export function visitSession(client: Client, iso: string, bookings: Booking[] = []): ProgramSession | null {
  if (!client.sessions.length) return null;
  const dates = [
    ...new Set(
      bookings
        .filter((b) => b.clientId === client.id)
        .map((b) => b.date),
    ),
  ].sort();
  const bookedToday = dates.includes(iso);
  const planned = client.trainDays.includes(dowIndex(iso));
  if (!bookedToday && !planned) return null;
  const doneBefore = dates.filter((d) => d < iso).length;
  const index = bookedToday ? doneBefore : doneBefore;
  return client.sessions[index % client.sessions.length];
}

export function epley1rm(weight: number, reps: number) {
  if (!(weight > 0) || !(reps > 0)) return 0;
  if (reps <= 1) return Math.round(weight * 10) / 10;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
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
    kbju: emptyKbju(),
    kbjuRest: emptyKbju(),
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
    phone: null,
  };
}

export function digitsPhone(raw: string | null | undefined) {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("8")) return `7${d.slice(1)}`;
  if (d.length === 10) return `7${d}`;
  return d;
}

export function formatPhone(raw: string | null | undefined) {
  const d = digitsPhone(raw);
  if (d.length === 11 && d.startsWith("7")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9)}`;
  }
  return (raw ?? "").trim();
}

function toB64(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64(s: string) {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export type ClientPass = {
  v: 1;
  firstName: string;
  lastName: string;
  phone: string | null;
  telegramUsername: string | null;
  sessionsLeft: number;
  packExpiresAt: string | null;
  kbju: Kbju;
  kbjuRest?: Kbju | null;
  programTitle: string;
  programWeeks: number;
  programStart: string;
  sessions: ProgramSession[];
  trainDays: number[];
  trainTimes: string[];
};

function kbjuFromTuple(t: number[] | undefined): Kbju {
  return {
    calories: t?.[0] ?? 0,
    protein: t?.[1] ?? 0,
    fat: t?.[2] ?? 0,
    carbs: t?.[3] ?? 0,
  };
}

export function exportClientPass(c: Client) {
  const body = {
    v: 2,
    n: c.firstName,
    l: c.lastName || "",
    u: c.telegramUsername || "",
    p: c.phone || "",
    s: c.sessionsLeft,
    e: c.packExpiresAt || "",
    k: [c.kbju.calories, c.kbju.protein, c.kbju.fat, c.kbju.carbs],
    r: c.kbjuRest ? [c.kbjuRest.calories, c.kbjuRest.protein, c.kbjuRest.fat, c.kbjuRest.carbs] : null,
  };
  return `ER.${toB64(JSON.stringify(body))}`;
}

export function importClientPass(raw: string): ClientPass | null {
  const s = raw.trim().replace(/\s+/g, "");
  const at = s.indexOf("ER.");
  const token = at >= 0 ? s.slice(at + 3) : "";
  if (!token) return null;
  try {
    const parsed = JSON.parse(fromB64(token)) as Record<string, unknown>;
    if (parsed?.v === 2) {
      const n = String(parsed.n ?? "");
      if (!n) return null;
      return {
        v: 1,
        firstName: n,
        lastName: String(parsed.l ?? ""),
        phone: String(parsed.p || "") || null,
        telegramUsername: String(parsed.u || "") || null,
        sessionsLeft: Number(parsed.s) || 0,
        packExpiresAt: String(parsed.e || "") || null,
        kbju: kbjuFromTuple(parsed.k as number[]),
        kbjuRest: parsed.r ? kbjuFromTuple(parsed.r as number[]) : null,
        programTitle: "",
        programWeeks: 8,
        programStart: isoDate(new Date()),
        sessions: [],
        trainDays: [],
        trainTimes: [],
      };
    }
    if (parsed?.v === 1 && parsed.firstName) return parsed as unknown as ClientPass;
    return null;
  } catch {
    return null;
  }
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

export function applyOfferBooking(input: {
  clients: Client[];
  bookings: Booking[];
  extraSlots: Slot[];
  closedSlotIds: string[];
  clientId: string;
  req: JoinRequest;
}): { clients: Client[]; bookings: Booking[]; booked: boolean } {
  const slotId = input.req.slotId;
  if (!slotId) return { clients: input.clients, bookings: input.bookings, booked: false };
  const bookingId = `bk_join_${input.req.telegramId}`;
  if (input.bookings.some((b) => b.id === bookingId || (b.slotId === slotId && b.clientId === input.clientId))) {
    return { clients: input.clients, bookings: input.bookings, booked: true };
  }
  if (input.closedSlotIds.includes(slotId)) return { clients: input.clients, bookings: input.bookings, booked: false };
  const [date, time] = slotId.split("_");
  const extra = input.extraSlots.find((s) => s.id === slotId);
  const generated = date && time ? generateWindow(startOfWeek(parseISODate(date)), 8).find((s) => s.id === slotId) : undefined;
  const slot = extra ?? generated;
  if (!slot || isSlotPast(slot.date, slot.time)) return { clients: input.clients, bookings: input.bookings, booked: false };
  if (input.bookings.filter((b) => b.slotId === slot.id).length >= slot.capacity) {
    return { clients: input.clients, bookings: input.bookings, booked: false };
  }
  const holdId = `tx_join_hold_${input.req.telegramId}`;
  const clients = input.clients.map((c) => {
    if (c.id !== input.clientId) return c;
    let left = c.sessionsLeft ?? 0;
    const ledger = [...(c.ledger ?? [])];
    if (left < 1) {
      left = 1;
      ledger.push({
        id: `tx_join_credit_${input.req.telegramId}`,
        clientId: c.id,
        kind: "credit",
        delta: 1,
        at: new Date().toISOString(),
        note: "Первая тренировка",
      });
    }
    left -= 1;
    ledger.push({
      id: holdId,
      clientId: c.id,
      kind: "hold",
      delta: -1,
      at: new Date().toISOString(),
      note: `Запись ${formatLongDate(slot.date)} ${slot.time}`,
      bookingId,
    });
    return { ...c, sessionsLeft: Math.max(0, left), ledger };
  });
  return {
    clients,
    bookings: [
      ...input.bookings,
      {
        id: bookingId,
        slotId: slot.id,
        clientId: input.clientId,
        date: slot.date,
        time: slot.time,
        duration: slot.duration,
        held: true,
      },
    ],
    booked: true,
  };
}
