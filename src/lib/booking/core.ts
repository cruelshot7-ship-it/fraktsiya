/**
 * Бронирование без серверных импортов (Telegram, TanStack): принимает уже проверенные данные
 * и `Sql`. Вызывается из `bookSlotFn` и из интеграционного теста на настоящем Postgres.
 *
 * Гарантии:
 * - расчёт мест идёт в одной транзакции на одном соединении (`sql.transaction`);
 * - `pg_advisory_xact_lock` по slotId сериализует конкурирующие записи на одно место;
 * - строку слота создаёт только `create`, а его собирает сервер (см. `clientCreateSpec`),
 *   а не произвольные поля из запроса клиента;
 * - отмена (`cancelBookingCore`) пишет статус в Neon под той же блокировкой, что и запись;
 * - отмена может указать версию записи (`rev`), которую клиент получил при записи. Если запись
 *   с тех пор заново создана (`rev` другой), старая отмена не трогает новое место.
 */
import type { Sql } from "../db-adapters";

export type CreateSpec = {
  ownerCoachId: string;
  /** Локальное время без зоны, `YYYY-MM-DDTHH:MM:SS`. */
  startsAt: string;
  timezone: string;
  durationMin: number;
  capacity: number;
  kind: "individual" | "group";
};

export type CoreBookInput = {
  slotId: string;
  clientId: string;
  /** Если слота в БД нет: строка создаётся по этим данным. Без него — `slot-missing`. */
  create?: CreateSpec | null;
};

export type CoreBookResult =
  | { ok: true; bookingId: string; rev: string; created: boolean }
  | { ok: false; reason: "slot-missing" | "slot-closed" | "full" };

export type ExtraSlotRow = {
  date: string;
  time: string;
  duration: number;
  capacity: number;
  ownerId?: string | null;
};

const clampInt = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
};

/**
 * Какой слот клиент может создать при первой записи (слота в БД ещё нет).
 * Только слот, который тренер сам добавил (`extra`): все поля берём из его сохранённых данных.
 * Вшитых слотов нет, поэтому без `extra` клиент слот не создаёт — null.
 */
export function clientCreateSpec(input: { trainerId: string; extra?: ExtraSlotRow | null }): CreateSpec | null {
  const e = input.extra;
  if (!e) return null;
  const capacity = clampInt(e.capacity, 1, 100, 1);
  return {
    ownerCoachId: e.ownerId ? String(e.ownerId) : input.trainerId,
    startsAt: `${e.date}T${e.time}:00`,
    timezone: "Europe/Minsk",
    durationMin: clampInt(e.duration, 1, 480, 60),
    capacity,
    kind: capacity <= 1 ? "individual" : "group",
  };
}

type SlotRow = { id: string; capacity: number; status: string; owner_coach_id: string };

/** Версия строки записи: микросекунды от эпохи, без зависимости от часового пояса сессии. */
const REV_SQL = "(extract(epoch from updated_at) * 1000000)::bigint::text";

export function bookingIdFor(slotId: string, clientId: string): string {
  return `bk_${slotId}_${clientId}`;
}

export async function bookSlotCore(sql: Sql, input: CoreBookInput): Promise<CoreBookResult> {
  return sql.transaction(async (tx): Promise<CoreBookResult> => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [input.slotId]);

    let slot = await findSlot(tx, input.slotId);
    if (!slot) {
      if (!input.create) return { ok: false, reason: "slot-missing" };
      await insertSlot(tx, input.slotId, input.create);
      slot = await findSlot(tx, input.slotId);
      if (!slot) return { ok: false, reason: "slot-missing" };
    }
    if (slot.status !== "open") return { ok: false, reason: "slot-closed" };

    const prior = await tx.query<{ id: string; rev: string }>(
      `select id, ${REV_SQL} as rev from slot_bookings where slot_id = $1 and client_id = $2 and status <> 'cancelled'`,
      [input.slotId, input.clientId],
    );
    // повторный запрос той же записи: ничего не создаём и тренера повторно не извещаем
    if (prior[0]) return { ok: true, bookingId: prior[0].id, rev: prior[0].rev, created: false };

    const countRows = await tx.query<{ n: string }>(
      "select count(*)::text as n from slot_bookings where slot_id = $1 and status <> 'cancelled'",
      [input.slotId],
    );
    const taken = Number(countRows[0]?.n ?? 0);
    if (taken >= slot.capacity) return { ok: false, reason: "full" };

    const bookingId = bookingIdFor(input.slotId, input.clientId);
    const written = await tx.query<{ rev: string }>(
      `insert into slot_bookings (id, slot_id, client_id, status)
       values ($1, $2, $3, 'confirmed')
       on conflict (slot_id, client_id) do update set status = 'confirmed', updated_at = now()
       returning ${REV_SQL} as rev`,
      [bookingId, input.slotId, input.clientId],
    );
    return { ok: true, bookingId, rev: written[0].rev, created: true };
  });
}

/** Владелец существующего слота (без блокировки — для проверки статуса тренера до записи). */
export async function slotOwnerOf(sql: Sql, slotId: string): Promise<string | null> {
  const rows = await sql.query<{ owner_coach_id: string }>(
    "select owner_coach_id from training_slots where id = $1",
    [slotId],
  );
  return rows[0]?.owner_coach_id ?? null;
}

async function findSlot(sql: Sql, slotId: string): Promise<SlotRow | null> {
  const rows = await sql.query<SlotRow>(
    "select id, capacity, status, owner_coach_id from training_slots where id = $1",
    [slotId],
  );
  return rows[0] ?? null;
}

/** `2026-12-01 10:00` и `2026-12-01T10:00Z` → `2026-12-01T10:00:00`-подобная строка без зоны. */
function localStamp(startsAt: string): string {
  const s = startsAt.includes("T") ? startsAt : startsAt.replace(" ", "T");
  return s.replace("Z", "").slice(0, 19);
}

async function insertSlot(sql: Sql, slotId: string, spec: CreateSpec): Promise<void> {
  await sql.query(
    `insert into training_slots
      (id, owner_coach_id, starts_at, timezone, duration_min, capacity, kind, status)
     values ($1, $2, $3::timestamptz, $4, $5, $6, $7, 'open')
     on conflict (id) do nothing`,
    [
      slotId,
      spec.ownerCoachId,
      localStamp(spec.startsAt),
      spec.timezone,
      spec.durationMin,
      spec.capacity,
      spec.kind,
    ],
  );
}

/**
 * Кто может отменить запись. Клиент — только свою (`selfIds`: как у записи на сервере).
 * Тренер — запись на слот, владелец которого он сам (`ownerCoachId` из training_slots).
 */
export function canCancelBooking(input: {
  role: "client" | "trainer";
  selfIds: string[];
  bookingClientId: string;
  sessionUserId: string;
  ownerCoachId: string | null;
}): boolean {
  if (input.role === "client") return input.selfIds.includes(input.bookingClientId);
  return input.ownerCoachId !== null && input.ownerCoachId === input.sessionUserId;
}

export type CoreCancelResult =
  | { ok: true; cancelled: boolean; stale?: boolean }
  | { ok: false; reason: "already-attended" };

export type CancelDecision = "not-found" | "already-cancelled" | "attended" | "stale" | "cancel";

/**
 * Решение по строке записи. Порядок важен: статус «пришёл» проверяем раньше версии,
 * иначе отметка тренера тихо проигнорировала бы отмену клиента.
 */
export function cancelDecision(row: { status: string; rev: string } | null, expectedRev?: string | null): CancelDecision {
  if (!row) return "not-found";
  if (row.status === "cancelled") return "already-cancelled";
  if (row.status === "attended" || row.status === "no_show") return "attended";
  if (expectedRev && row.rev !== expectedRev) return "stale";
  return "cancel";
}

/**
 * Отмена записи в Neon. Без неё место остаётся занятым: подсчёт мест считает все не отменённые строки.
 * Идемпотентна: повторная отмена и отмена записи, которой нет в Neon, — не ошибка.
 * Блокировка по slotId та же, что у записи: отмена и запись на одно место не идут параллельно.
 * Если `expectedRev` задан и запись создана заново после него — отмена не применяется (`stale`).
 */
export async function cancelBookingCore(
  sql: Sql,
  input: { slotId: string; clientId: string; actorId?: string | null; expectedRev?: string | null },
): Promise<CoreCancelResult> {
  return sql.transaction(async (tx): Promise<CoreCancelResult> => {
    await tx.query("select pg_advisory_xact_lock(hashtext($1))", [input.slotId]);
    const bookingId = bookingIdFor(input.slotId, input.clientId);
    const rows = await tx.query<{ status: string; rev: string }>(
      `select status, ${REV_SQL} as rev from slot_bookings where id = $1`,
      [bookingId],
    );
    switch (cancelDecision(rows[0] ?? null, input.expectedRev)) {
      case "not-found":
      case "already-cancelled":
        return { ok: true, cancelled: false };
      case "attended":
        return { ok: false, reason: "already-attended" };
      case "stale":
        return { ok: true, cancelled: false, stale: true };
      case "cancel":
        await tx.query(
          "update slot_bookings set status = 'cancelled', cancelled_at = now(), cancelled_by = $2, updated_at = now() where id = $1",
          [bookingId, input.actorId ?? null],
        );
        return { ok: true, cancelled: true };
    }
  });
}
