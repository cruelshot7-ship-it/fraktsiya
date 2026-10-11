/**
 * Бронирование без серверных импортов (Telegram, TanStack): принимает уже проверенные данные
 * и `Sql`. Вызывается из `bookSlotFn` и из интеграционного теста на настоящем Postgres.
 *
 * Гарантии:
 * - расчёт мест идёт в одной транзакции на одном соединении (`sql.transaction`);
 * - `pg_advisory_xact_lock` по slotId сериализует конкурирующие записи на одно место;
 * - строку слота создаёт только `create`, а его собирает сервер (см. `clientCreateSpec`),
 *   а не произвольные поля из запроса клиента.
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
  | { ok: true; bookingId: string }
  | { ok: false; reason: "slot-missing" | "slot-closed" | "full" };

/** Слот из расписания по умолчанию: id вида `2026-10-12_10:00`. */
const DEFAULT_SLOT_ID = /^(\d{4}-\d{2}-\d{2})_(\d{2}:\d{2})$/;

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
 * - Дополнительный слот тренера (`extra`) — все поля берём из сохранённых данных тренера.
 * - Слот по умолчанию — владелец всегда тренер, дата и время из id. Ёмкость — от клиента
 *   (в пределах 1..100): расписание по умолчанию сервер не хранит. Это остаточный риск, см. PR.
 * - Всё остальное — null: клиент слот не создаёт.
 */
export function clientCreateSpec(input: {
  slotId: string;
  trainerId: string;
  extra?: ExtraSlotRow | null;
  clientCapacity?: number;
}): CreateSpec | null {
  if (input.extra) {
    const e = input.extra;
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
  const m = DEFAULT_SLOT_ID.exec(input.slotId);
  if (!m) return null;
  const capacity = clampInt(input.clientCapacity ?? 1, 1, 100, 1);
  return {
    ownerCoachId: input.trainerId,
    startsAt: `${m[1]}T${m[2]}:00`,
    timezone: "Europe/Minsk",
    durationMin: 60,
    capacity,
    kind: capacity <= 1 ? "individual" : "group",
  };
}

type SlotRow = { id: string; capacity: number; status: string; owner_coach_id: string };

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

    const prior = await tx.query<{ id: string }>(
      "select id from slot_bookings where slot_id = $1 and client_id = $2 and status <> 'cancelled'",
      [input.slotId, input.clientId],
    );
    if (prior[0]) return { ok: true, bookingId: prior[0].id };

    const countRows = await tx.query<{ n: string }>(
      "select count(*)::text as n from slot_bookings where slot_id = $1 and status <> 'cancelled'",
      [input.slotId],
    );
    const taken = Number(countRows[0]?.n ?? 0);
    if (taken >= slot.capacity) return { ok: false, reason: "full" };

    const bookingId = bookingIdFor(input.slotId, input.clientId);
    await tx.query(
      `insert into slot_bookings (id, slot_id, client_id, status)
       values ($1, $2, $3, 'confirmed')
       on conflict (slot_id, client_id) do update set status = 'confirmed', updated_at = now()`,
      [bookingId, input.slotId, input.clientId],
    );
    return { ok: true, bookingId };
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
