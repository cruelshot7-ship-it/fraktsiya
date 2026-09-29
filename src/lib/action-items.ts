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
  tab: "slots" | "bookings" | "program" | "clients" | "signals" | "hall";
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
      tab: "bookings",
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
        tab: "slots",
        clientId: client.id,
        priority: 15,
      });
    } else {
      items.push({
        id: `act_book_${client.id}`,
        kind: "book_next",
        title: "Записаться",
        body: "Свободные окна вашего тренера",
        tab: "slots",
        clientId: client.id,
        priority: 25,
      });
    }
  }

  if (last && !last.checkedIn && !last.noShow) {
    const age = daysSince(`${last.date}T${last.time}:00`);
    if (age !== null && age <= 2) {
      items.push({
        id: `act_log_${last.id}`,
        kind: "log_result",
        title: "Итог занятия",
        body: "Зафиксируйте подходы — тренер увидит факт",
        tab: "program",
        bookingId: last.id,
        clientId: client.id,
        priority: 18,
      });
    }
  }

  for (const n of notices
    .filter((x) => x.clientId === client.id && x.audience === "client")
    .slice(0, 2)) {
    items.push({
      id: `act_notice_${n.id}`,
      kind: "progression_decision",
      title: n.title,
      body: n.body,
      tab: "program",
      clientId: client.id,
      priority: 30,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

export function trainerActionItems(opts: {
  clients: Client[];
  bookings: Booking[];
  slots: Slot[];
  notices: Notice[];
  joinPendingCount: number;
  coachId?: string | null;
}): ActionItem[] {
  const { clients, bookings, slots, notices, joinPendingCount } = opts;
  const today = isoDate(new Date());
  const items: ActionItem[] = [];

  const todayBookings = bookings
    .filter((b) => b.date === today && !b.noShow)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (todayBookings.length) {
    const first = todayBookings[0];
    const who = clients.find((c) => c.id === first.clientId);
    items.push({
      id: `act_sched_${today}`,
      kind: "trainer_schedule",
      title: `Сегодня · ${todayBookings.length} зан.`,
      body: who ? `Первый: ${who.firstName} · ${first.time}` : `Первое в ${first.time}`,
      tab: "bookings",
      bookingId: first.id,
      priority: 5,
    });
  }

  const recentPast = bookings.filter((b) => {
    if (!isSlotPast(b.date, b.time) || b.noShow) return false;
    const age = daysSince(`${b.date}T${b.time}:00`);
    return age !== null && age <= 3 && !b.checkedIn;
  });
  if (recentPast.length) {
    items.push({
      id: "act_review_results",
      kind: "review_results",
      title: "Нужна отметка присутствия",
      body: `${recentPast.length} занят. без явки`,
      tab: "bookings",
      priority: 12,
    });
  }

  const withUpcoming = new Set(
    bookings.filter((b) => !isSlotPast(b.date, b.time) && !b.noShow).map((b) => b.clientId),
  );
  const orphan = clients.filter((c) => !withUpcoming.has(c.id)).slice(0, 5);
  if (orphan.length) {
    items.push({
      id: "act_orphan_clients",
      kind: "client_without_booking",
      title: "Без следующей записи",
      body: orphan.map((c) => c.firstName).join(", "),
      tab: "clients",
      priority: 22,
    });
  }

  const returned: string[] = [];
  for (const c of clients) {
    if (withUpcoming.has(c.id)) continue;
    const past = bookings
      .filter((b) => b.clientId === c.id && isSlotPast(b.date, b.time) && !b.noShow)
      .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
    const last = past[0];
    if (!last) continue;
    const gap = daysSince(`${last.date}T${last.time}:00`);
    if (gap !== null && gap >= 14) returned.push(c.firstName);
  }
  if (returned.length) {
    items.push({
      id: "act_return_clients",
      kind: "return_soft",
      title: "Вернулись после перерыва",
      body: returned.slice(0, 5).join(", "),
      tab: "clients",
      priority: 18,
    });
  }

  const openSlots = slots.filter((s) => !isSlotPast(s.date, s.time)).length;
  if (openSlots > 0) {
    items.push({
      id: "act_open_slots",
      kind: "open_slot",
      title: "Свободные слоты",
      body: `${openSlots} в окне расписания`,
      tab: "slots",
      priority: 40,
    });
  }

  if (joinPendingCount > 0) {
    items.push({
      id: "act_joins",
      kind: "pending_join",
      title: "Заявки в зал",
      body: `${joinPendingCount} ожидают решения`,
      tab: "signals",
      priority: 8,
    });
  }

  for (const n of notices.filter((x) => x.audience === "trainer").slice(0, 3)) {
    items.push({
      id: `act_tn_${n.id}`,
      kind: "missing_note",
      title: n.title,
      body: n.body,
      tab: "signals",
      clientId: n.clientId,
      priority: 28,
    });
  }

  return items.sort((a, b) => a.priority - b.priority).slice(0, 10);
}
