/**
 * Адаптеры SQL без побочных эффектов (нет импорта pg и PGLite, нет загрузки при импорте).
 * Можно тестировать напрямую; `db.ts` собирает из них рабочий `getSql()`.
 *
 * Главное правило: всё, что идёт между BEGIN и COMMIT, выполняется на ОДНОМ соединении.
 * `pool.query` на каждый вызов может брать разные соединения, поэтому
 * `sql.query("begin")` / `sql.query("commit")` на пуле — это не транзакция.
 * Для этого есть `sql.transaction(fn)`.
 */

export interface Sql {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /**
   * Выполнить `fn` в одной транзакции на одном соединении.
   * Вернул значение — COMMIT. Бросил исключение — ROLLBACK и повторный throw.
   * Вложенный вызов внутри уже открытой транзакции выполняется в ней же (без savepoint).
   */
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

/** Минимальный интерфейс соединения: pg.PoolClient, pg.Client и PGlite совместимы через обёртку. */
export type Conn = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

/** Пул, который умеет выдать отдельное соединение, и вернуть его через release(). */
export type PoolLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  connect: () => Promise<Conn & { release: () => void }>;
};

/** Транзакционный раннер конкретного бэкенда (пул или PGlite). */
export type Transact = <T>(fn: (tx: Sql) => Promise<T>) => Promise<T>;

/** Построить Sql поверх одного запроса `run` и раннера транзакций `transact`. */
export function toSql(
  run: <T>(text: string, params: unknown[]) => Promise<T[]>,
  transact: Transact,
): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]> => {
    let text = strings[0];
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1]}`;
    return run<T>(text, values);
  }) as unknown as Sql;
  sql.query = <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
    run<T>(text, params);
  sql.transaction = transact;
  return sql;
}

/** Sql поверх уже закреплённого соединения. Вложенный transaction — тот же контекст. */
export function sqlOver(conn: Conn): Sql {
  const run = async <T>(text: string, params: unknown[]): Promise<T[]> => {
    const res = await conn.query(text, params);
    return res.rows as T[];
  };
  const sql: Sql = toSql(run, (fn) => fn(sql));
  return sql;
}

/** BEGIN / fn / COMMIT на одном соединении; при ошибке ROLLBACK. */
export async function runOnConnection<T>(
  conn: Conn,
  fn: (tx: Sql) => Promise<T>,
): Promise<T> {
  await conn.query("BEGIN");
  let result: T;
  try {
    result = await fn(sqlOver(conn));
  } catch (err) {
    try {
      await conn.query("ROLLBACK");
    } catch {
      /* соединение уже сломано; исходную ошибку сохраняем */
    }
    throw err;
  }
  try {
    await conn.query("COMMIT");
  } catch (err) {
    try {
      await conn.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw err;
  }
  return result;
}

/** Sql поверх пула: каждая транзакция берёт своё соединение и возвращает его в пул. */
export function sqlFromPool(pool: PoolLike): Sql {
  const run = async <T>(text: string, params: unknown[]): Promise<T[]> => {
    const res = await pool.query(text, params);
    return res.rows as T[];
  };
  const transact: Transact = async (fn) => {
    const client = await pool.connect();
    try {
      return await runOnConnection(client, fn);
    } finally {
      client.release();
    }
  };
  return toSql(run, transact);
}
