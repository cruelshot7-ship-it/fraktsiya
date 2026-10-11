/**
 * Меню дня в сохранённом состоянии: проверка записи, видимость, слияние, запись в журнал.
 * Тренер подтверждает варианты (offers) из базы, клиент выбирает из них (choice).
 * Чистая логика, без БД: тестируется без сервера.
 */

/** Снимок блюда на момент сборки меню: меню не зависит от будущих правок базы. */
export type MenuDish = { name: string; calories: number; protein: number; fat: number; carbs: number };

export type MenuRecord = {
  id: string;
  clientId: string;
  /** YYYY-MM-DD */
  date: string;
  count: 3 | 4 | 5;
  /** варианты тренера на каждый приём: slotId → dishId[] (до 3) */
  offers: Record<string, string[]>;
  /** снимки блюд из offers: dishId → данные блюда */
  dishes: Record<string, MenuDish>;
  /** выбор клиента: slotId → dishId, только из offers */
  choice: Record<string, string>;
  /** черновик тренера не виден клиенту, пока не подтверждён */
  confirmed: boolean;
  /** время подтверждения: выбор клиента относится только к одному подтверждению */
  confirmedAt: string | null;
  updatedAt: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ID = 80;
const MAX_SLOT = 40;
const MAX_OFFERS = 3;
const MAX_DISHES = 60;
const MAX_KCAL = 5000;

function cleanSlot(slot: string): boolean {
  return slot.length > 0 && slot.length <= MAX_SLOT;
}

function shortText(v: unknown, max: number): string | null {
  return typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
}

function macro(v: unknown, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
}

function checkDish(raw: unknown): MenuDish | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const name = shortText(d.name, 120);
  const calories = macro(d.calories, MAX_KCAL);
  const protein = macro(d.protein, 1000);
  const fat = macro(d.fat, 1000);
  const carbs = macro(d.carbs, 1000);
  if (name === null || calories === null || protein === null || fat === null || carbs === null) return null;
  return { name, calories, protein, fat, carbs };
}

/** Проверка записи из внешнего источника. Неверная запись отбрасывается целиком; неверные блюда — по одному. */
export function checkMenuRecord(raw: unknown): MenuRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = shortText(r.id, MAX_ID);
  const clientId = shortText(r.clientId, MAX_ID);
  const date = typeof r.date === "string" && ISO_DATE.test(r.date) ? r.date : null;
  const count = r.count === 3 || r.count === 4 || r.count === 5 ? r.count : null;
  if (!id || !clientId || !date || !count) return null;
  if (!r.offers || typeof r.offers !== "object" || Array.isArray(r.offers)) return null;
  if (r.choice !== undefined && (!r.choice || typeof r.choice !== "object" || Array.isArray(r.choice))) return null;

  const offers: Record<string, string[]> = {};
  for (const [slot, list] of Object.entries(r.offers as Record<string, unknown>)) {
    if (!cleanSlot(slot) || !Array.isArray(list)) continue;
    const dishes = list.filter((d): d is string => shortText(d, MAX_ID) !== null).slice(0, MAX_OFFERS);
    offers[slot] = [...new Set(dishes)];
  }

  const dishesRaw = r.dishes && typeof r.dishes === "object" && !Array.isArray(r.dishes) ? (r.dishes as Record<string, unknown>) : {};
  const dishes: Record<string, MenuDish> = {};
  for (const [dishId, d] of Object.entries(dishesRaw).slice(0, MAX_DISHES)) {
    if (!shortText(dishId, MAX_ID)) continue;
    const dish = checkDish(d);
    if (dish) dishes[dishId] = dish;
  }

  const choiceRaw = (r.choice ?? {}) as Record<string, unknown>;
  const choice: Record<string, string> = {};
  for (const [slot, dish] of Object.entries(choiceRaw)) {
    if (!cleanSlot(slot) || shortText(dish, MAX_ID) === null) continue;
    choice[slot] = dish as string;
  }

  const confirmed = r.confirmed === true;
  const updatedAt = typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : "";
  const confirmedAt = confirmed ? shortText(r.confirmedAt, 40) ?? (updatedAt || null) : null;

  return {
    id,
    clientId,
    date,
    count,
    offers,
    dishes: pruneDishes(dishes, offers),
    choice: validChoice(choice, offers),
    confirmed,
    confirmedAt,
    updatedAt,
  };
}

/** Список из внешнего источника: неверные записи отбрасываются по одной. */
export function checkMenus(raw: unknown): MenuRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => checkMenuRecord(m)).filter((m): m is MenuRecord => m !== null);
}

/** Оставляет только выбор из предложенных вариантов. Всё лишнее отбрасывается. */
export function validChoice(choice: Record<string, string>, offers: Record<string, string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [slot, dish] of Object.entries(choice)) {
    if ((offers[slot] ?? []).includes(dish)) out[slot] = dish;
  }
  return out;
}

/** Снимки оставляем только для блюд, которые ещё предложены. */
export function pruneDishes(dishes: Record<string, MenuDish>, offers: Record<string, string[]>): Record<string, MenuDish> {
  const offered = new Set(Object.values(offers).flat());
  return Object.fromEntries(Object.entries(dishes).filter(([id]) => offered.has(id)));
}

/** Один день у одного клиента — одна запись. */
export function menuKey(m: Pick<MenuRecord, "clientId" | "date">): string {
  return `${m.clientId}|${m.date}`;
}

/** Клиент видит только свои подтверждённые меню. Черновики тренера до клиента не доходят. */
export function menusForClient(menus: MenuRecord[], clientId: string | null): MenuRecord[] {
  if (!clientId) return [];
  return menus.filter((m) => m.clientId === clientId && m.confirmed);
}

/**
 * Запись тренера заменяет меню его клиентов целиком. Меню чужих клиентов не трогаются.
 * ownClientIds — и прежние, и новые клиенты тренера: меню удалённых клиентов уходят вместе с ними.
 */
export function mergeMenus(current: MenuRecord[], incoming: MenuRecord[], ownClientIds: Set<string>): MenuRecord[] {
  const map = new Map<string, MenuRecord>();
  for (const m of current) if (!ownClientIds.has(m.clientId)) map.set(menuKey(m), m);
  for (const m of incoming) if (ownClientIds.has(m.clientId)) map.set(menuKey(m), m);
  return [...map.values()];
}

/**
 * Клиент пишет только свой выбор в подтверждённом меню, и только того же подтверждения.
 * Если тренер пересобрал и подтвердил меню заново, старый выбор не возвращается.
 */
export function applyClientChoices(current: MenuRecord[], incoming: MenuRecord[], clientId: string): MenuRecord[] {
  const sent = new Map(incoming.filter((m) => m.clientId === clientId).map((m) => [menuKey(m), m]));
  return current.map((m) => {
    if (m.clientId !== clientId || !m.confirmed || !m.confirmedAt) return m;
    const row = sent.get(menuKey(m));
    if (!row || row.confirmedAt !== m.confirmedAt) return m;
    return { ...m, choice: validChoice(row.choice, m.offers) };
  });
}

/**
 * Локальный выбор клиента сильнее присланного, пока он не отправлен: иначе обновление
 * сбрасывает только что сделанный выбор. Только для того же подтверждения, что на сервере.
 * Варианты берутся с сервера.
 */
export function keepClientChoices(server: MenuRecord[], local: MenuRecord[]): MenuRecord[] {
  const mine = new Map(local.map((m) => [menuKey(m), m]));
  return server.map((s) => {
    const l = mine.get(menuKey(s));
    if (!l || !s.confirmed || !s.confirmedAt || l.confirmedAt !== s.confirmedAt) return s;
    if (Object.keys(l.choice).length === 0) return s;
    return { ...s, choice: validChoice(l.choice, s.offers) };
  });
}

/** Префикс идентификаторов записей журнала, которые созданы из меню дня. */
export function menuLogPrefix(rec: Pick<MenuRecord, "clientId" | "date">): string {
  return `menu_${rec.clientId}_${rec.date}_`;
}

export type MenuLogEntry = MenuDish & { id: string; logId: string; clientId: string; date: string };

/**
 * Записи журнала питания из выбранных блюд меню. Идентификатор записи зависит от приёма,
 * поэтому повторная запись не дублирует еду, а смена блюда заменяет старое.
 */
export function menuChoiceLogs(rec: MenuRecord, fallback: (dishId: string) => MenuDish | undefined): MenuLogEntry[] {
  return Object.entries(rec.choice).flatMap(([slotId, dishId]) => {
    const dish = rec.dishes[dishId] ?? fallback(dishId);
    if (!dish) return [];
    return [{ ...dish, id: dishId, logId: `${menuLogPrefix(rec)}${slotId}`, clientId: rec.clientId, date: rec.date }];
  });
}
