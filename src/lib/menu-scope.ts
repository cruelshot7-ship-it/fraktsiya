/**
 * Меню дня в сохранённом состоянии: проверка записи, видимость для клиента, слияние при записи тренера.
 * Чистая логика, без БД: тестируется без сервера.
 */

export type MenuRecord = {
  id: string;
  clientId: string;
  /** YYYY-MM-DD */
  date: string;
  count: 3 | 4 | 5;
  /** slotId → dishId из базы блюд */
  selection: Record<string, string>;
  /** черновик тренера не виден клиенту, пока не подтверждён */
  confirmed: boolean;
  updatedAt: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ID = 80;

/** Проверка записи из внешнего источника. Неверная запись отбрасывается целиком. */
export function checkMenuRecord(raw: unknown): MenuRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" && r.id.length > 0 && r.id.length <= MAX_ID ? r.id : null;
  const clientId = typeof r.clientId === "string" && r.clientId.length > 0 && r.clientId.length <= MAX_ID ? r.clientId : null;
  const date = typeof r.date === "string" && ISO_DATE.test(r.date) ? r.date : null;
  const count = r.count === 3 || r.count === 4 || r.count === 5 ? r.count : null;
  if (!id || !clientId || !date || !count) return null;
  if (!r.selection || typeof r.selection !== "object" || Array.isArray(r.selection)) return null;
  const selection: Record<string, string> = {};
  for (const [slot, dish] of Object.entries(r.selection as Record<string, unknown>)) {
    if (typeof dish !== "string" || dish.length === 0 || dish.length > MAX_ID) continue;
    if (slot.length === 0 || slot.length > 40) continue;
    selection[slot] = dish;
  }
  return {
    id,
    clientId,
    date,
    count,
    selection,
    confirmed: r.confirmed === true,
    updatedAt: typeof r.updatedAt === "string" ? r.updatedAt.slice(0, 40) : "",
  };
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
