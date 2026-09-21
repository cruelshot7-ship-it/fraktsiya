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
