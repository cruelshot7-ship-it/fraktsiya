import type { BodyMeasure } from "@/lib/body-measures";
import type { Consent } from "@/lib/privacy";
import { hoursUntilSlotAt, isLateCancelAt, slotStartMs } from "@/lib/minsk-time";
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
  /** breakfast | lunch | dinner | snack — for constructor filters */
  kind?: "breakfast" | "lunch" | "dinner" | "snack";
};

export const MEALS: Meal[] = [
  { id: "oats", name: "Овсянка с яйцом", calories: 420, protein: 24, fat: 14, carbs: 48, kind: "breakfast" },
  { id: "omelette", name: "Омлет и тост", calories: 450, protein: 28, fat: 26, carbs: 24, kind: "breakfast" },
  { id: "yogurt", name: "Творог с ягодами", calories: 290, protein: 26, fat: 8, carbs: 28, kind: "breakfast" },
  { id: "shake", name: "Протеин-шейк", calories: 240, protein: 32, fat: 4, carbs: 18, kind: "snack" },
  { id: "bowl", name: "Боул с курицей", calories: 610, protein: 48, fat: 18, carbs: 52, kind: "lunch" },
  { id: "salad", name: "Тёплый салат", calories: 380, protein: 32, fat: 16, carbs: 22, kind: "lunch" },
  { id: "beef", name: "Говядина и гречка", calories: 720, protein: 52, fat: 22, carbs: 64, kind: "lunch" },
  { id: "salmon", name: "Лосось и рис", calories: 680, protein: 42, fat: 28, carbs: 54, kind: "dinner" },
  { id: "turkey_buck", name: "Индейка и булгур", calories: 540, protein: 46, fat: 12, carbs: 48, kind: "dinner" },
  { id: "cod_potato", name: "Треска и картофель", calories: 480, protein: 38, fat: 10, carbs: 52, kind: "dinner" },
  { id: "chicken_rice", name: "Курица и рис", calories: 560, protein: 44, fat: 12, carbs: 58, kind: "lunch" },
  { id: "cottage_cucu", name: "Творог и огурец", calories: 220, protein: 28, fat: 6, carbs: 12, kind: "snack" },
  { id: "apple_pb", name: "Яблоко и арахис", calories: 260, protein: 8, fat: 14, carbs: 28, kind: "snack" },
  { id: "egg_wrap", name: "Яичный ролл", calories: 380, protein: 26, fat: 18, carbs: 28, kind: "breakfast" },
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
  ownerId?: string | null;
};

export type Booking = {
  id: string;
  slotId: string;
  clientId: string;
  date: string;
  time: string;
  duration: number;
  held?: boolean;
  /** id of the session hold ledger entry that paid for this booking */
  holdId?: string;
  checkedIn?: boolean;
  noShow?: boolean;
  reminded24?: boolean;
  reminded2?: boolean;
  confirmed?: boolean;
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

export type DayCheck = {
  id: string;
  clientId: string;
  date: string;
  steps: number;
  sleepHours: number;
  waterMl: number;
  moveMin: number;
  moveKind: string;
  /** 1-5, optional recovery */
  fatigue?: number;
  /** 1-5, optional recovery */
  soreness?: number;
  /** 0-3, optional recovery */
  pain?: number;
  source?: "apple" | "hand";
};

export type Visit = {
  id: string;
  clientId: string;
  date: string;
  at: string;
  waterMl: number;
};

export const ARRIVE_WATER = 250;

export const FORM_GOALS = {
  steps: 8000,
  sleep: 7.5,
  water: 2500,
  move: 30,
};

export const MOVE_KINDS = ["Ходьба", "Бег", "Велосипед", "Дома"] as const;
export const FATSECRET_URL = "https://www.fatsecret.com/";
export const TRACKABLES_URL = "https://apps.apple.com/app/id6745567488";

export type LiftLog = {
  id: string;
  date: string;
  exercise: string;
  weight: number;
  reps: number;
  sets: number;
  /** Reps in reserve at the end of the set (0 = to failure). Optional: old records have none. */
  rir?: number;
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

export type BuildGoal = "strength" | "shape" | "cut";

/** Готовые сплиты по правилам: новичок / опытный / верх / низ / full body */
export type ProgramPreset = "beginner" | "experienced" | "fullbody" | "upper" | "lower";

export const PROGRAM_PRESETS: { id: ProgramPreset; label: string; hint: string }[] = [
  { id: "beginner", label: "Новичок", hint: "3× full body · техника · 2–3 подхода" },
  { id: "experienced", label: "Опытный", hint: "4× верх/низ · больше объёма" },
  { id: "fullbody", label: "Full body", hint: "3× всё тело · база" },
  { id: "upper", label: "Верх", hint: "2 дня верха · жим + тяга" },
  { id: "lower", label: "Низ", hint: "2 дня низа · присед + шарнир" },
];

function plate(kg: number) {
  return Math.max(20, Math.round(kg / 2.5) * 2.5);
}

function block(name: string, sets: string, kg: number | null, rest: number) {
  return [name, sets, ...(kg ? [`${kg} кг`] : []), `Отдых ${rest} секунд`];
}

export function buildProgram(
  client: Pick<Client, "weight" | "trainDays">,
  goal: BuildGoal,
  preset: ProgramPreset = "beginner",
) {
  const bw = client.weight > 0 ? client.weight : 0;
  const scheme = goal === "strength" ? "5×5" : goal === "cut" ? "3×12-15" : "3×8-10";
  const begScheme = goal === "strength" ? "3×5" : goal === "cut" ? "2×12-15" : "2×8-10";
  const rest = goal === "strength" ? 180 : goal === "cut" ? 60 : 90;
  const begRest = goal === "strength" ? 120 : 90;
  const scale = goal === "strength" ? 1 : goal === "cut" ? 0.65 : 0.8;
  const begScale = scale * 0.75;
  const lift = (name: string, ratio: number | null, sets = scheme, r = rest, sc = scale) =>
    block(name, sets, ratio && bw ? plate(bw * ratio * sc) : null, r);
  const body = (name: string, sets = scheme, r = rest) => block(name, sets, null, r);

  /** Новичок: 3 full body, мало объёма, паттерны присед/жим/тяга/кор */
  const beginner = [
    {
      name: "Full body A",
      focus: "Присед · жим · тяга",
      items: [
        ...lift("Гоблет-присед / присед", 0.35, begScheme, begRest, begScale),
        ...lift("Жим гантелей / жим лёжа", 0.3, begScheme, begRest, begScale),
        ...lift("Тяга гантели в наклоне", 0.25, begScheme, begRest, begScale),
        ...body("Планка", "3×20-40 сек", begRest),
      ],
    },
    {
      name: "Full body B",
      focus: "Шарнир · жим стоя · тяга",
      items: [
        ...lift("Румынская тяга", 0.4, begScheme, begRest, begScale),
        ...lift("Жим стоя / гантели", 0.2, begScheme, begRest, begScale),
        ...body("Тяга верхнего блока / подтягивания", begScheme, begRest),
        ...body("Ягодичный мост", "3×10-12", begRest),
      ],
    },
    {
      name: "Full body C",
      focus: "Ноги · отжимания · кор",
      items: [
        ...lift("Выпады / болгарские", 0.15, begScheme, begRest, begScale),
        ...body("Отжимания / брусья", begScheme, begRest),
        ...lift("Тяга к поясу сидя", 0.3, begScheme, begRest, begScale),
        ...body("Dead bug / bird-dog", "3×8/сторона", begRest),
      ],
    },
  ];

  /** Опытный: upper/lower 4 дня */
  const experienced = [
    {
      name: "Верх A · жим",
      focus: "Грудь · плечи · трицепс",
      items: [
        ...lift("Жим лёжа", 0.5),
        ...lift("Жим гантелей наклон", 0.28),
        ...lift("Жим стоя", 0.3),
        ...body("Отжимания на брусьях", "3×8-12"),
        ...body("Разгибания на трицепс", "3×12-15", 60),
      ],
    },
    {
      name: "Низ A · присед",
      focus: "Квадрицепс · ягодицы",
      items: [
        ...lift("Присед", 0.75),
        ...lift("Румынская тяга", 0.55),
        ...lift("Выпады", 0.22),
        ...body("Подъём на носки", "3×12-15", 60),
        ...body("Планка", "3×30-45 сек", 60),
      ],
    },
    {
      name: "Верх B · тяга",
      focus: "Спина · бицепс · задняя дельта",
      items: [
        ...lift("Тяга в наклоне", 0.45),
        ...body("Подтягивания / блок", scheme),
        ...lift("Тяга гантели", 0.28),
        ...body("Face pull", "3×12-15", 60),
        ...body("Подъём на бицепс", "3×10-12", 60),
      ],
    },
    {
      name: "Низ B · шарнир",
      focus: "Задняя цепь · присед",
      items: [
        ...lift("Становая тяга", 0.9),
        ...lift("Фронт-присед / гоблет", 0.5),
        ...lift("Гиперэкстензия / good morning", 0.25),
        ...body("Сгибания ног", "3×10-12", 60),
        ...body("Боковая планка", "3×20-30 сек", 60),
      ],
    },
  ];

  /** Full body 3× */
  const fullbody = [
    {
      name: "Full body A",
      focus: "Присед · жим · горизонтальная тяга",
      items: [
        ...lift("Присед", 0.7),
        ...lift("Жим лёжа", 0.45),
        ...lift("Тяга в наклоне", 0.4),
        ...body("Face pull", "3×12-15", 60),
        ...body("Планка", "3×30 сек", 60),
      ],
    },
    {
      name: "Full body B",
      focus: "Шарнир · жим стоя · вертикальная тяга",
      items: [
        ...lift("Румынская / становая", 0.7),
        ...lift("Жим стоя", 0.28),
        ...body("Подтягивания / блок", scheme),
        ...lift("Выпады", 0.2),
        ...body("Скручивания", "3×12-15", 45),
      ],
    },
    {
      name: "Full body C",
      focus: "Ноги · жим · тяга",
      items: [
        ...lift("Присед / гоблет", 0.55),
        ...lift("Жим гантелей", 0.3),
        ...lift("Тяга к поясу", 0.35),
        ...body("Отжимания на брусьях", "3×8-12"),
        ...body("Ягодичный мост", "3×10-12", 60),
      ],
    },
  ];

  /** Специализация верх */
  const upper = [
    {
      name: "Верх · жимовой",
      focus: "Грудь · плечи · трицепс",
      items: [
        ...lift("Жим лёжа", 0.5),
        ...lift("Жим гантелей наклон", 0.28),
        ...lift("Жим стоя", 0.3),
        ...body("Разведения гантелей", "3×12-15", 60),
        ...body("Отжимания на брусьях", "3×8-12"),
        ...body("Разгибания на трицепс", "3×12-15", 60),
      ],
    },
    {
      name: "Верх · тяговый",
      focus: "Спина · бицепс · задняя дельта",
      items: [
        ...lift("Тяга в наклоне", 0.45),
        ...body("Подтягивания / блок", scheme),
        ...lift("Тяга гантели", 0.28),
        ...body("Face pull", "3×12-15", 60),
        ...body("Подъём на бицепс", "3×10-12", 60),
        ...body("Молотки", "3×12", 60),
      ],
    },
  ];

  /** Специализация низ */
  const lower = [
    {
      name: "Низ · присед",
      focus: "Квадрицепс · ягодицы · икры",
      items: [
        ...lift("Присед", 0.75),
        ...lift("Выпады / болгарские", 0.22),
        ...lift("Жим ногами / гоблет", 0.9),
        ...body("Разгибания ног", "3×12-15", 60),
        ...body("Подъём на носки", "3×12-15", 45),
        ...body("Планка", "3×30-45 сек", 60),
      ],
    },
    {
      name: "Низ · шарнир",
      focus: "Задняя цепь · ягодицы",
      items: [
        ...lift("Становая тяга", 0.9),
        ...lift("Румынская тяга", 0.55),
        ...lift("Ягодичный мост / hip thrust", 0.6),
        ...body("Сгибания ног", "3×10-12", 60),
        ...body("Good morning / гиперэкстензия", "3×10-12", 60),
        ...body("Боковая планка", "3×20-30 сек", 60),
      ],
    },
  ];

  const byPreset: Record<ProgramPreset, { name: string; focus: string; items: string[] }[]> = {
    beginner,
    experienced,
    fullbody,
    upper,
    lower,
  };

  const sessions = byPreset[preset] ?? beginner;
  const goalTitle = goal === "strength" ? "Сила" : goal === "cut" ? "Снижение" : "Форма";
  const presetTitle =
    preset === "beginner"
      ? "Новичок · full body"
      : preset === "experienced"
        ? "Опытный · верх/низ"
        : preset === "fullbody"
          ? "Full body"
          : preset === "upper"
            ? "Верх"
            : "Низ";

  return {
    programTitle: `${presetTitle} · ${goalTitle}`,
    sessions: sessions.map((session, index) => ({ ...session, id: `built_${index + 1}` })),
  };
}

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
  absentDays: number;
  address: string;
};

export const DEFAULT_NOTIFY: NotifyPrefs = {
  windowHours: 2,
  notifyClient: true,
  notifyTrainer: true,
  flagLate: true,
  absentDays: 10,
  address: "",
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
  measures?: BodyMeasure[];
  consent?: Consent | null;
  erasedAt?: string | null;
  lateCancels?: number;
  sessionsLeft: number;
  ledger: SessionTxn[];
  /** ids of every balance event already applied on the server (dedupe for sync) */
  txnIds?: string[];
  /** server-stamped history of consent acceptances and erasures */
  consentLog?: import("@/lib/privacy").ConsentEvent[];
  frozenUntil?: string | null;
  packExpiresAt?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  phone?: string | null;
  coachId?: string | null;
  healthToken?: string | null;
  sessionByDate?: Record<string, string> | null;
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
  return slotStartMs(date, time) <= Date.now();
}

export function hoursUntilSlot(date: string, time: string) {
  return hoursUntilSlotAt(date, time, Date.now());
}

export function isLateCancel(date: string, time: string, windowHours: number) {
  return isLateCancelAt(date, time, Date.now(), windowHours);
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
  const start = new Date(slotStartMs(booking.date, booking.time));
  const end = new Date(start.getTime() + booking.duration * 60000);
  // UTC with Z: the calendar app converts to the phone's zone itself
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
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

export function relativeDayLabel(iso: string, today = isoDate(new Date())) {
  if (iso === today) return "Сегодня";
  if (iso === isoDate(addDays(parseISODate(today), 1))) return "Завтра";
  return formatWeekdayLong(iso);
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
  const last = (client.lastName ?? "").trim();
  if (!last) return client.firstName;
  return `${client.firstName} ${last.charAt(0)}.`;
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

/** A pinned day wins. Otherwise visits follow the program in order. */
export function visitSession(client: Client, iso: string, bookings: Booking[] = []): ProgramSession | null {
  if (!client.sessions.length) return null;
  const pinned = client.sessionByDate?.[iso];
  if (pinned) {
    const chosen = client.sessions.find((session) => session.id === pinned);
    if (chosen) return chosen;
  }
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
  return client.sessions[doneBefore % client.sessions.length];
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
    measures: [],
    lateCancels: 0,
    sessionsLeft: 0,
    ledger: [],
    frozenUntil: null,
    packExpiresAt: null,
    telegramId: null,
    telegramUsername: null,
    phone: null,
    healthToken: null,
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
  const hasReport = Boolean(client.lastReportAt);
  const noReport = hasReport && daysSinceReport >= 3;
  const neverReported = !hasReport;
  const lateOften = (client.lateCancels ?? 0) >= 2;
  const lowPack = (client.sessionsLeft ?? 0) <= 2;
  const frozen = isFrozen(client, today);
  const expiring = packDaysLeft(client, today);
  const todayBook = bookings.find((b) => b.clientId === client.id && b.date === today);
  const todayTrain = client.trainDays.includes(dowIndex(today));
  const todayOn = Boolean(todayBook || todayTrain);
  const attention =
    noReport || neverReported || lowCal || lateOften || lowPack || frozen || (expiring !== null && expiring <= 7);
  let badge: string | null = null;
  let tone: ClientFlag["tone"] = "none";
  if (frozen) {
    badge = `заморозка до ${formatDayMonth(client.frozenUntil!)}`;
    tone = "alert";
  } else if (noReport && daysSinceReport <= 60) {
    badge = `нет отчёта ${daysSinceReport} ${daysRu(daysSinceReport)}`;
    tone = "alert";
  } else if (noReport || neverReported) {
    badge = "нет отчёта";
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
