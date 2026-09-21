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

export const WEEKDAY_TIMES = ["10:00", "12:00", "18:00", "19:00", "20:00"];
export const SATURDAY_TIMES = ["10:00", "11:00", "16:00"];

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
