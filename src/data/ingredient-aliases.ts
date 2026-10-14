/**
 * Перевод названий продуктов из рецептов в поисковые термины справочника USDA (на английском).
 * Термины — подсказки для подбора, а не готовые соответствия: продукт выбирает тренер.
 * Ключ — название из разбора рецепта (recipe-text.ts). Проверка полноты — ingredient-match.test.ts.
 *
 * Термин совпадает с записью справочника, если все его слова есть в названии записи (порядок не важен).
 * note — то, что тренер должен уточнить по смыслу.
 */
export type IngredientAlias = {
  ru: string;
  en: string[];
  note?: string;
};

export const INGREDIENT_ALIASES: IngredientAlias[] = [
  { ru: "Авокадо", en: ["avocado"] },
  { ru: "Арахисовая паста без сахара", en: ["peanut butter"], note: "в USDA без сахара отдельно не выделяется, проверить состав" },
  { ru: "Бальзамик", en: ["vinegar, balsamic"] },
  { ru: "Банан", en: ["banana"] },
  { ru: "Белки", en: ["egg, white"], note: "белки яиц, не яйца целиком" },
  { ru: "Болгарский перец", en: ["pepper, sweet"] },
  { ru: "Брокколи", en: ["broccoli"] },
  { ru: "Брокколи или стручковая фасоль", en: ["broccoli", "green beans"], note: "составная строка: выбрать одно" },
  { ru: "Булгур", en: ["bulgur"] },
  { ru: "Говядина (лопатка или вырезка, до 10% жира)", en: ["beef chuck", "beef tenderloin"], note: "лопатка или вырезка" },
  { ru: "Горчица", en: ["mustard"], note: "по строке ½ ч. л., нужна плотность" },
  { ru: "Гречка", en: ["buckwheat"] },
  { ru: "Индейка (филе)", en: ["turkey breast"] },
  { ru: "Картофель", en: ["potatoes"] },
  { ru: "Кукуруза", en: ["corn, sweet"] },
  { ru: "Кунжут", en: ["sesame seeds"] },
  { ru: "Куриная грудка", en: ["chicken breast"] },
  { ru: "Лимон", en: ["lemon"] },
  { ru: "Лосось филе", en: ["salmon"] },
  { ru: "Лук", en: ["onions"] },
  { ru: "Масло", en: ["oil, vegetable"], note: "растительное или сливочное — уточнить" },
  { ru: "Масло сливочное", en: ["butter"] },
  { ru: "Мёд", en: ["honey"] },
  { ru: "Микс салатов", en: ["lettuce"], note: "смесь листовых салатов" },
  { ru: "Молоко 2,5%", en: ["milk, lowfat"] },
  { ru: "Морковь", en: ["carrots"] },
  { ru: "Овсянка", en: ["oats"] },
  { ru: "Огурец", en: ["cucumber"] },
  { ru: "Оливковое масло", en: ["oil, olive"] },
  { ru: "Паприка", en: ["paprika"] },
  { ru: "Перец", en: ["pepper, black"], note: "в списках приправ — чёрный перец" },
  { ru: "Перец болгарский", en: ["pepper, sweet"] },
  { ru: "Перец болгарский и брокколи", en: ["pepper, sweet", "broccoli"], note: "составная строка: разделить" },
  { ru: "Помидор", en: ["tomatoes"] },
  { ru: "Помидоры черри", en: ["tomatoes, grape"], note: "в USDA черри обычно называется grape tomatoes" },
  { ru: "Рис", en: ["rice"], note: "состояние (сухой/отварной) задаёт выбор записи" },
  { ru: "Соевый соус", en: ["soy sauce"] },
  { ru: "Сок лайма", en: ["lime juice"] },
  { ru: "Соль", en: ["salt, table"] },
  { ru: "Специи", en: ["spices"], note: "слишком общее — тренер указывает конкретные" },
  { ru: "Сывороточный протеин", en: ["whey"] },
  { ru: "Сыр", en: ["cheese"], note: "уточнить сорт" },
  { ru: "Творог 5%", en: ["cheese, cottage"], note: "в USDA нет 5% отдельно — ближайшая запись по жирности" },
  { ru: "Тортилья пшеничная", en: ["tortillas, flour"] },
  { ru: "Треска (филе)", en: ["cod"] },
  { ru: "Укроп", en: ["dill"] },
  { ru: "Фета", en: ["cheese, feta"] },
  { ru: "Цельнозерновой хлеб", en: ["bread, whole-wheat"] },
  { ru: "Цельнозерновые сухарики", en: ["crackers, whole-wheat"], note: "уточнить" },
  { ru: "Цукини", en: ["squash, summer, zucchini"] },
  { ru: "Чёрный перец", en: ["pepper, black"] },
  { ru: "Чеснок", en: ["garlic"] },
  { ru: "Яблоко", en: ["apples"] },
  { ru: "Ягоды (черника, клубника)", en: ["blueberries", "strawberries"], note: "две ягоды в одной строке" },
  { ru: "Яйца", en: ["egg, whole"] },
];
