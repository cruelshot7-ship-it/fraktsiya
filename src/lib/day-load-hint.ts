/**
 * Подсказки на тренировочный день: сон, самочувствие и питание меняют план нагрузки.
 * Это только предложения клиенту. Менять программу и добавлять объём может только тренер.
 */

export type LoadHintTone = "reduce" | "extra" | "fuel";
export type LoadHint = { tone: LoadHintTone; text: string };

export type DayLoadInput = {
  sleepHours: number;
  /** 1–5; null — не заполнено или нет согласия на данные о здоровье */
  fatigue: number | null;
  soreness: number | null;
  /** съедено за день, ккал; 0 — не заполнено */
  kcal: number;
  /** норма ккал на тренировочный день */
  targetKcal: number;
};

export function trainDayHints(input: DayLoadInput): LoadHint[] {
  const hints: LoadHint[] = [];
  const tired = input.fatigue !== null && input.fatigue >= 4;
  const sore = input.soreness !== null && input.soreness >= 4;
  const shortSleep = input.sleepHours > 0 && input.sleepHours < 6;

  if (shortSleep || tired || sore) {
    const why = shortSleep ? "Сон меньше 6 часов" : tired ? "Высокая усталость" : "Сильная крепатура";
    hints.push({ tone: "reduce", text: `${why}: на тренировке лучше снизить объём на 20–30% или взять лёгкий вариант упражнения.` });
  } else if (input.sleepHours >= 7 && input.fatigue !== null && input.fatigue <= 2 && (input.soreness ?? 0) <= 2) {
    hints.push({ tone: "extra", text: "Самочувствие хорошее: можно добавить подход или 10 минут кардио в конце." });
  }

  if (input.kcal > 0 && input.targetKcal > 0 && input.kcal < input.targetKcal * 0.8) {
    hints.push({ tone: "fuel", text: "За день калорий мало для тренировочного дня: в следующий раз добавьте углеводы до занятия." });
  }
  return hints;
}

/** Сигнал тренеру: короткий сон или высокая усталость в тренировочный день. null — сигнала нет. */
export function trainerSignalText(input: { sleepHours: number; fatigue: number | null; soreness: number | null }): string | null {
  if (input.sleepHours > 0 && input.sleepHours < 6) return `Сон ${input.sleepHours} ч в тренировочный день`;
  if (input.fatigue !== null && input.fatigue >= 4) return `Усталость ${input.fatigue}/5 в тренировочный день`;
  if (input.soreness !== null && input.soreness >= 4) return `Крепатура ${input.soreness}/5 в тренировочный день`;
  return null;
}
