/**
 * Расчёт суточной калорийности и КБЖУ. Чистые функции: без БД, без UI, без ИИ.
 * Начальная оценка, а не измерение метаболизма. Итог подтверждает тренер.
 */
import {
  ACTIVITY_FACTORS,
  GOAL_ADJUSTMENT,
  KCAL_FLOOR,
  KCAL_PER_GRAM,
  LIMITS,
  MACRO_DEFAULTS,
  type ActivityLevel,
  type Goal,
} from "./nutrition-config";

export type Sex = "male" | "female";

export type CalcFlags = {
  /** Несовершеннолетний: автоматический расчёт не применяется. */
  minor?: boolean;
  /** Беременность или кормление: автоматический расчёт не применяется. */
  pregnancy?: boolean;
  /** Назначенная врачом диета или состояние с особыми потребностями: расчёт не применяется. */
  medicalDiet?: boolean;
};

export type CalcInput = {
  sex?: Sex | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  activity?: ActivityLevel | null;
  goal?: Goal | null;
  flags?: CalcFlags;
};

export type Macros = { protein: number; fat: number; carbs: number };

export type CalcResult =
  | {
      ok: true;
      bmr: number;
      tdee: number;
      targetKcal: number;
      macros: Macros;
      /** Калории, пересчитанные из округлённых макросов: сверка с targetKcal. */
      kcalFromMacros: number;
      /** Короткие пояснения для тренера: например, сработал минимум калорий. */
      notes: string[];
    }
  | { ok: false; error: string };

/** Основной обмен по Миффлину — Сан Жеору, ккал/сутки. Вес кг, рост см, возраст лет. */
export function mifflinBmr(sex: Sex, age: number, heightCm: number, weightKg: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

/** Энергия по макронутриентам: белок и углеводы по 4 ккал/г, жир по 9 ккал/г. */
export function kcalFromMacros(m: Macros): number {
  return Math.round(KCAL_PER_GRAM.protein * m.protein + KCAL_PER_GRAM.carbs * m.carbs + KCAL_PER_GRAM.fat * m.fat);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Проверка входных данных и расчёт. Не подставляет выдуманных значений:
 * если нет пола, возраста, роста, веса, активности или цели, возвращается ошибка с перечнем.
 */
export function calculateTargets(input: CalcInput): CalcResult {
  const flags = input.flags ?? {};
  if (flags.minor) return { ok: false, error: "Для несовершеннолетних автоматический расчёт не применяется." };
  if (flags.pregnancy) return { ok: false, error: "При беременности и кормлении автоматический расчёт не применяется." };
  if (flags.medicalDiet) return { ok: false, error: "При назначенной врачом диете расчёт ведёт специалист вручную." };

  const missing: string[] = [];
  if (!input.sex) missing.push("пол");
  if (!isFiniteNumber(input.age)) missing.push("возраст");
  if (!isFiniteNumber(input.heightCm)) missing.push("рост");
  if (!isFiniteNumber(input.weightKg)) missing.push("вес");
  if (!input.activity) missing.push("активность");
  if (!input.goal) missing.push("цель");
  if (missing.length) return { ok: false, error: `Не хватает данных: ${missing.join(", ")}.` };

  // Здесь все поля заполнены, но TypeScript не видит этого после проверки выше.
  const sex = input.sex as Sex;
  const age = input.age as number;
  const heightCm = input.heightCm as number;
  const weightKg = input.weightKg as number;
  const activity = input.activity as ActivityLevel;
  const goal = input.goal as Goal;

  if (age < LIMITS.age.min || age > LIMITS.age.max) {
    return { ok: false, error: `Возраст вне диапазона ${LIMITS.age.min}–${LIMITS.age.max} лет.` };
  }
  if (heightCm < LIMITS.heightCm.min || heightCm > LIMITS.heightCm.max) {
    return { ok: false, error: `Рост вне диапазона ${LIMITS.heightCm.min}–${LIMITS.heightCm.max} см.` };
  }
  if (weightKg < LIMITS.weightKg.min || weightKg > LIMITS.weightKg.max) {
    return { ok: false, error: `Вес вне диапазона ${LIMITS.weightKg.min}–${LIMITS.weightKg.max} кг.` };
  }

  const notes: string[] = [];
  const bmr = mifflinBmr(sex, age, heightCm, weightKg);
  const tdee = bmr * ACTIVITY_FACTORS[activity].factor;
  let targetKcal = tdee * (1 + GOAL_ADJUSTMENT[goal]);

  const floor = KCAL_FLOOR[sex];
  if (targetKcal < floor) {
    targetKcal = floor;
    notes.push(`Расчёт поднят до минимума ${floor} ккал. Тренер подтверждает.`);
  }
  targetKcal = Math.round(targetKcal / 10) * 10;

  const protein = Math.round(MACRO_DEFAULTS.proteinPerKg * weightKg);
  const fat = Math.round(MACRO_DEFAULTS.fatPerKg * weightKg);
  const carbs = Math.round((targetKcal - KCAL_PER_GRAM.protein * protein - KCAL_PER_GRAM.fat * fat) / KCAL_PER_GRAM.carbs);

  if (carbs < 0) {
    return { ok: false, error: "Нормы белка и жира не помещаются в целевую калорийность. Тренер корректирует параметры." };
  }

  const macros: Macros = { protein, fat, carbs };
  return {
    ok: true,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetKcal,
    macros,
    kcalFromMacros: kcalFromMacros(macros),
    notes,
  };
}
