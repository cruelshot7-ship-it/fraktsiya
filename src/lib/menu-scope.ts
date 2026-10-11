/**
 * Меню дня в сохранённом состоянии: проверка записи, видимость, слияние.
 * Тренер подтверждает варианты (offers) из базы, клиент выбирает из них (choice).
 * Чистая логика, без БД: тестируется без сервера.
 */

export type MenuRecord = {
  id: string;
  clientId: string;
  /** YYYY-MM-DD */
  date: string;
  count: 3 | 4 | 5;
  /** варианты тренера на каждый приём: slotId → dishId[] (до 3) */
  offers: Record<string, string[]>;
  /** выбор клиента: slotId → dishId, только из offers */
  choice: Record<string, string>;
  /** черновик тренера не виден клиенту, пока не подтверждён */
  confirmed: boolean;
  updatedAt: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ID = 80;
const MAX_SLOT = 40;
const MAX_OFFERS = 3;

function cleanSlot(slot: string): boolean {
  return slot.length > 0 && slot.length <= MAX_SLOT;
}

/** Проверка записи из внешнего источника. Неверная запись отбрасывается целиком; неверные блюда — по одному. */
export function checkMenuRecord(raw: unknown): MenuRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.length > 0 && r.id.length <= MAX_ID ? r.id : null;
  const clientId = typeof r.clientId === "string" && r.clientId.length > 0 && r.clientId.length <= MAX_ID ? r.clientId : null;
  const date = typeof r.date === "string" && ISO_DATE.test(r.date) ? r.date : null;
  const count = r.count === 3 || r.count === 4 || r.count === 5 ? r.count : null;
  if (!id || !clientId || !date || !count) return null;
  if (!r.offers || typeof r.offers !== "object" || Array.isArray(r.offers)) return null;
  if (r.choice !== undefined && (!r.choice || typeof r.choice !== "object" || Array.isArray(r.choice))) return null;

  const offers: Record<string, string[]> = {};
  for (const [slot, list] of Object.entries(r.offers as Record<string, unknown>)) {
    if (!cleanSlot(slot) || !Array.isArray(list)) continue;
    const dishes = list
      .filter((d): d is string => typeof d === "string" && d.length > 0 && d.length <= MAX_ID)
      .slice(0, MAX_OFFERS);
    offers[slot] = [...new Set(dishes)];
  }

  const choiceRaw = (r.choice ?? {}) as Record<string, unknown>;
  const choice: Record<string, string> = {};
  for (const [slot, dish] of Object.entries(choiceRaw)) {
    if (!cleanSlot(slot) || typeof dish !== "string" || dish.length === 0 || dish.length > MAX_ID) continue;
    choice[slot] = dish;
  }

  return {
    id,
    clientId,
    date,
    count,
    offers,
    choice: validChoice(choice, offers),
    confirmed: r.confirmed === true,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : "",
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
 * Клиент пишет только свой выбор в подтверждённых меню. Тренерские варианты и черновики не меняются.
 * Выбор принимается только из предложенных вариантов.
 */
export function applyClientChoices(current: MenuRecord[], incoming: MenuRecord[], clientId: string): MenuRecord[] {
  const sent = new Map(incoming.filter((m) => m.clientId === clientId).map((m) => [menuKey(m), m]));
  return current.map((m) => {
    if (m.clientId !== clientId || !m.confirmed) return m;
    const row = sent.get(menuKey(m));
    if (!row) return m;
    return { ...m, choice: validChoice(row.choice, m.offers) };
  });
}

/**
 * Локальный выбор клиента сильнее присланного, пока он не отправлен: иначе обновление
 * сбрасывает только что сделанный выбор. Варианты берутся с сервера.
 */
export function keepClientChoices(server: MenuRecord[], local: MenuRecord[]): MenuRecord[] {
  const mine = new Map(local.map((m) => [menuKey(m), m]));
  return server.map((s) => {
    const l = mine.get(menuKey(s));
    if (!l || !s.confirmed || Object.keys(l.choice).length === 0) return s;
    return { ...s, choice: validChoice(l.choice, s.offers) };
  });
}
