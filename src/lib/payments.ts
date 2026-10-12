/**
 * Оплаты и цена занятия, в BYN. Чистые функции, без импортов.
 * Оплата — учёт денег тренера. Она НЕ меняет баланс занятий: занятия зачисляются
 * отдельно (кнопки +N в карточке клиента), как и раньше.
 * Поля `price` и `payments` видны только тренеру: клиенту их не отдаём.
 */

export type Payment = {
  id: string;
  /** дата оплаты, YYYY-MM-DD */
  at: string;
  /** сумма, BYN, до копеек */
  amount: number;
  /** сколько занятий куплено этой оплатой; 0, если не указано */
  sessions: number;
};

export const MAX_AMOUNT = 100000;

/**
 * "1 200", "1200,5", "1200.50" -> число. Пусто, ноль, минус, больше двух знаков
 * после точки или сумма больше MAX_AMOUNT — null.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!(n > 0) || n > MAX_AMOUNT) return null;
  return Math.round(n * 100) / 100;
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Сумма и число оплат клиентов за месяц ym ("YYYY-MM"). */
export function revenueForMonth(clients: { payments?: Payment[] }[], ym: string) {
  let sum = 0;
  let count = 0;
  for (const c of clients) {
    for (const p of c.payments ?? []) {
      if (monthOf(p.at) !== ym) continue;
      sum += p.amount;
      count += 1;
    }
  }
  return { sum: Math.round(sum * 100) / 100, count };
}

/** Последние оплаты: новые сверху. */
export function recentPayments(payments: Payment[] | undefined, n = 3): Payment[] {
  return [...(payments ?? [])].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)).slice(0, n);
}

const MONTHS_RU = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

/** "2026-10" -> "октябрь 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${MONTHS_RU[Number(m) - 1] ?? ym} ${y}`;
}

/** Копия клиента без денежных полей — для экрана самого клиента. */
export function withoutTrainerMoney<T extends { price?: unknown; payments?: unknown }>(client: T): T {
  const copy = { ...client };
  delete copy.price;
  delete copy.payments;
  return copy;
}

export type PaymentRow = { clientId: string; name: string; payment: Payment };

/** Оплаты месяца по всем клиентам: новые сверху. Только для тренера. */
export function paymentRowsForMonth(
  clients: { id: string; firstName: string; lastName: string; payments?: Payment[] }[],
  ym: string,
): PaymentRow[] {
  const rows: PaymentRow[] = [];
  for (const c of clients) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Клиент";
    for (const p of c.payments ?? []) {
      if (monthOf(p.at) === ym) rows.push({ clientId: c.id, name, payment: p });
    }
  }
  return rows.sort((a, b) => b.payment.at.localeCompare(a.payment.at) || b.payment.id.localeCompare(a.payment.id));
}

/** Соседний месяц: shiftMonth("2026-01", -1) -> "2025-12". */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}
