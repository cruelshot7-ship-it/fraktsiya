/**
 * Situational action items for the Action Center.
 * Pure helpers — no server calls. UI routes via setTab / ids.
 */

type Booking = {
  id: string;
  clientId: string;
  date: string;
  time: string;
  duration: number;
  checkedIn?: boolean;
  noShow?: boolean;
  slotId?: string;
};
type Client = { id: string; firstName: string; [k: string]: unknown };
type Notice = {
  id: string;
  audience: string;
  clientId?: string;
  kind: string;
  title: string;
  body: string;
  at: string;
};
type Slot = { id: string; date: string; time: string; [k: string]: unknown };

function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function isSlotPast(date: string, time: string): boolean {
  const t = Date.parse(`${date}T${time}:00`);
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

export type ActionKind =
  | "next_session"
  | "today_plan"
  | "log_result"
  | "progression_decision"
  | "book_next"
  | "return_soft"
  | "trainer_schedule"
  | "review_results"
  | "missing_note"
  | "client_without_booking"
  | "open_slot"
  | "pending_join";

export type ActionItem = {
  id: string;
  kind: ActionKind;
  title: string;
  body: string;
  tab: "today" | "schedule" | "program" | "clients" | "signals" | "hall" | "more" | "slots" | "bookings";
  clientId?: string;
  bookingId?: string;
  priority: number;
};

function daysSince(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

export function clientActionItems(opts: {
  client: Client;
  bookings: Booking[];
  slots: Slot[];
  notices: Notice[];
}): ActionItem[] {
  const { client, bookings, notices } = opts;
  const today = isoDate(new Date());
  const mine = bookings.filter((b) => b.clientId === client.id);
  const upcoming = mine
    .filter((b) => !isSlotPast(b.date, b.time) && !b.noShow)
    .sort((a, b) => `${a.date}_${a.time}`.localeCompare(`${b.date}_${b.time}`));
  const next = upcoming[0];
  const past = mine
    .filter((b) => isSlotPast(b.date, b.time))
    .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
  const last = past[0];
  const items: ActionItem[] = [];

  if (next) {
    items.push({
      id: `act_next_${next.id}`,
      kind: "next_session",
      title: `Ближайшая · ${next.time}`,
      body: `${next.date === today ? "Сегодня" : next.date} · ${next.duration} мин`,
      tab: "schedule",
      bookingId: next.id,
      clientId: client.id,
      priority: 10,
    });
    if (next.date === today) {
      items.push({
        id: `act_plan_${next.id}`,
        kind: "today_plan",
        title: "План на сегодня",
        body: "Откройте программу занятия",
        tab: "program",
        bookingId: next.id,
        clientId: client.id,
        priority: 20,
      });
    }
  } else {
    const gap = last ? daysSince(`${last.date}T${last.time}:00`) : null;
    if (gap !== null && gap >= 14) {
      items.push({
        id: `act_return_${client.id}`,
        kind: "return_soft",
        title: "Спокойный возврат",
        body: "После перерыва нагрузку не поднимаем автоматически — выберите удобный слот.",
        tab: "schedule",
        clientId: client.id,
        priority: 15,
      });
    } else {
      items.push({
        id: `act_book_${client.id}`,
        kind: "book_next",
        title: "Записаться на тренировку",
        body: "Выберите свободный слот в расписании",
        tab: "schedule",
        clientId: client.id,
        priority: 25,
      });
    }
  }

  if (last?.checkedIn) {
    items.push({
      id: `act_log_${last.id}`,
      kind: "log_result",
      title: "Зафиксировать результат",
      body: "После занятия — факты для прогрессии",
      tab: "program",
      bookingId: last.id,
      clientId: client.id,
      priority: 18,
    });
  }

  const clientNotices = notices.filter(
    (n) => n.audience === "client" && n.clientId === client.id && (n.kind === "cancel" || n.kind === "reschedule"),
  );
  for (const n of clientNotices.slice(0, 2)) {
    items.push({
      id: `act_n_${n.id}`,
      kind: "book_next",
      title: n.title,
      body: n.body,
      tab: "schedule",
      clientId: client.id,
      priority: 12,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

export function trainerActionItems(opts: {
  clients: Client[];
  bookings: Booking[];
  slots: Slot[];
  notices: Notice[];
  joinPendingCount: number;
}): ActionItem[] {
  const { clients, bookings, slots, notices, joinPendingCount } = opts;
  const today = isoDate(new Date());
  const items: ActionItem[] = [];

  const todayBookings = bookings.filter((b) => b.date === today && !b.noShow);
  if (todayBookings.length) {
    items.push({
      id: "act_tr_today",
      kind: "trainer_schedule",
      title: `Сегодня · ${todayBookings.length} записей`,
      body: "Отметьте явку и результаты",
      tab: "schedule",
      priority: 10,
    });
  }

  const needResult = todayBookings.filter((b) => b.checkedIn);
  if (needResult.length) {
    items.push({
      id: "act_tr_results",
      kind: "review_results",
      title: "Результаты после явки",
      body: `${needResult.length} с отмеченной явкой",
      tab: "schedule",
      priority: 14,
    });
  }

  const withoutBooking = clients.filter((c) => !bookings.some((b) => b.clientId === c.id && !isSlotPast(b.date, b.time)));
  if (withoutBooking.length) {
    items.push({
      id: "act_tr_nobook",
      kind: "client_without_booking",
      title: "Без ближайшей записи",
      body: `${withoutBooking.length} клиентов · предложите слот`,
      tab: "clients",
      clientId: withoutBooking[0]?.id,
      priority: 22,
    });
  }

  const openSlots = slots.filter((s) => !isSlotPast(String(s.date), String(s.time)));
  if (openSlots.length === 0) {
    items.push({
      id: "act_tr_openslot",
      kind: "open_slot",
      title: "Добавьте слоты",
      body: "В расписании нет открытых окон",
      tab: "schedule",
      priority: 28,
    });
  }

  if (joinPendingCount > 0) {
    items.push({
      id: "act_tr_join",
      kind: "pending_join",
      title: `Заявки в зал · ${joinPendingCount}`,
      body: "Примите или отклоните",
      tab: "signals",
      priority: 8,
    });
  }

  const trainerSignals = notices.filter((n) => n.audience === "trainer" && n.kind !== "join");
  if (trainerSignals.length) {
    items.push({
      id: "act_tr_signals",
      kind: "missing_note",
      title: "Сигналы",
      body: `${trainerSignals.length} без разбора`,
      tab: "signals",
      priority: 16,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 8);
}
