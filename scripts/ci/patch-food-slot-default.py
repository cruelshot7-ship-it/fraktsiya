from pathlib import Path

# 1) nutrition default slot + permissive filter
p = Path("src/components/app/nutrition-view.tsx")
t = p.read_text()
t2 = t.replace(
    'const [slot, setSlot] = useState<Slot>(() => hourSlot(new Date().getHours()));',
    'const [slot, setSlot] = useState<Slot>("all");',
    1,
)
t2 = t2.replace(
    'if (slot !== "all") pool = pool.filter((m) => (m.kind ?? "snack") === slot);',
    'if (slot !== "all") {\n      const tagged = pool.some((m) => m.kind);\n      if (tagged) pool = pool.filter((m) => (m.kind ?? slot) === slot);\n    }',
    1,
)
if t2 == t:
    print("nutrition no change")
else:
    p.write_text(t2)
    print("nutrition ok")

# 2) MEALS expand
p = Path("src/data/studio.ts")
t = p.read_text()
if "turkey_buck" in t:
    print("meals already")
else:
    old_type = """export type Meal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};"""
    new_type = """export type Meal = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  kind?: "breakfast" | "lunch" | "dinner" | "snack";
};"""
    if old_type in t:
        t = t.replace(old_type, new_type, 1)
    old_meals = """export const MEALS: Meal[] = [
  { id: "oats", name: "Овсянка с яйцом", calories: 420, protein: 24, fat: 14, carbs: 48 },
  { id: "bowl", name: "Боул с курицей", calories: 610, protein: 48, fat: 18, carbs: 52 },
  { id: "salmon", name: "Лосось и рис", calories: 680, protein: 42, fat: 28, carbs: 54 },
  { id: "salad", name: "Тёплый салат", calories: 380, protein: 32, fat: 16, carbs: 22 },
  { id: "shake", name: "Протеин-шейк", calories: 240, protein: 32, fat: 4, carbs: 18 },
  { id: "omelette", name: "Омлет и тост", calories: 450, protein: 28, fat: 26, carbs: 24 },
  { id: "beef", name: "Говядина и гречка", calories: 720, protein: 52, fat: 22, carbs: 64 },
  { id: "yogurt", name: "Творог с ягодами", calories: 290, protein: 26, fat: 8, carbs: 28 },
];"""
    new_meals = """export const MEALS: Meal[] = [
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
];"""
    if old_meals not in t:
        raise SystemExit("MEALS missing")
    p.write_text(t.replace(old_meals, new_meals, 1))
    print("meals ok")
