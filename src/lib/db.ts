import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import {
  sqlFromPool,
  sqlOver,
  toSql,
  type Sql,
  type Transact,
} from "./db-adapters";

export type { Sql } from "./db-adapters";

/** Which database backend is active. */
export type DbSource = "neon" | "pglite";

function resolveDatabaseUrl(raw?: string) {
  if (!raw?.trim()) return undefined;
  const s = raw.trim().replace(/^['"]|['"]$/g, "");
  if (/^postgres(ql)?:\/\//i.test(s)) return s;
  return undefined;
}

/** Prefer pooled DATABASE_URL; if invalid/empty, try UNPOOLED (Neon integration). */
function databaseUrlNow(): string | undefined {
  if (typeof process === "undefined") return undefined;
  return (
    resolveDatabaseUrl(process.env.DATABASE_URL) ||
    resolveDatabaseUrl(process.env.DATABASE_URL_UNPOOLED)
  );
}

/** Production: PGLite в браузерном IndexedDB/на сервере не является хранилищем. Без базы — отказ. */
function isProductionRuntime(): boolean {
  return typeof process !== "undefined" && process.env.NODE_ENV === "production";
}

export function getDbSource(): DbSource {
  return databaseUrlNow() ? "neon" : "pglite";
}

/**
 * Snapshot of backend at first module evaluation.
 * Prefer getDbSource() — env (DATABASE_URL) may become available later on cold start.
 * Kept for backward compatibility; refreshed when getSql() runs.
 */
export let dbSource: DbSource = getDbSource();

const globalRef = globalThis as typeof globalThis & {
  __pgSqlPromise__?: Promise<Sql>;
  __pgliteInstance__?: Promise<import("@electric-sql/pglite").PGlite>;
  __pgliteMigrateChain__?: Promise<void>;
};

const OID_INT8 = 20;
const OID_DATE = 1082;
const OID_INTERVAL = 1186;
const identity = (v: string) => v;

function createNeonSql(connectionString: string): Promise<Sql> {
  globalRef.__pgSqlPromise__ ??= (async () => {
    const { Pool, types } = await import("pg");
    types.setTypeParser(OID_INT8, Number);
    types.setTypeParser(OID_DATE, identity);
    types.setTypeParser(OID_INTERVAL, identity);
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    return sqlFromPool({
      query: (text, params) => pool.query(text, params).then((r) => ({ rows: r.rows })),
      connect: async () => {
        const client = await pool.connect();
        return {
          query: (text, params) =>
            client.query(text, params).then((r) => ({ rows: r.rows })),
          release: () => client.release(),
        };
      },
    });
  })().catch((err) => {
    globalRef.__pgSqlPromise__ = undefined;
    throw err;
  });
  return globalRef.__pgSqlPromise__;
}

async function createPgliteSql(): Promise<Sql> {
  globalRef.__pgliteInstance__ ??= (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite("idb://ruksha-discipline");
    await pg.exec(`
      create table if not exists _migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      );
    `);
    return pg;
  })().catch((err) => {
    globalRef.__pgliteInstance__ = undefined;
    throw err;
  });
  const pg = await globalRef.__pgliteInstance__;

  const migrate = async (): Promise<void> => {
    const migrations = import.meta.glob("/migrations/*.sql", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const doneRows = await pg.query<{ name: string }>(
      "select name from _migrations",
    );
    const done = doneRows.rows.map((r) => r.name);
    for (const { name, path } of pendingMigrations(Object.keys(migrations), done)) {
      await pg.transaction(async (tx) => {
        await tx.exec(migrations[path]);
        await tx.query("insert into _migrations (name) values ($1)", [name]);
      });
    }
  };
  const pass = (globalRef.__pgliteMigrateChain__ ?? Promise.resolve())
    .catch(() => undefined)
    .then(migrate);
  globalRef.__pgliteMigrateChain__ = pass;
  await pass;

  const transact: Transact = (fn) =>
    pg.transaction((tx) => fn(sqlOver({ query: (text, params) => tx.query(text, params) })));

  return toSql(
    async <T>(text: string, params: unknown[]) => {
      const result = await pg.query<T>(text, params);
      return result.rows;
    },
    transact,
  );
}

let sqlPromise: Promise<Sql> | null = null;

async function createSql(): Promise<Sql> {
  if (typeof window !== "undefined") {
    throw new Error(
      "@/lib/db is server-only — call getSql() from a createServerFn handler " +
        "or a server route loader, never from client code.",
    );
  }
  const url = databaseUrlNow();
  if (url) return createNeonSql(url);
  if (isProductionRuntime()) {
    // Fail closed: в проде без DATABASE_URL данные не должны уходить в локальный PGLite.
    throw new Error("DATABASE_URL is not set in production; PGLite fallback is disabled");
  }
  return createPgliteSql();
}

export function getSql(): Promise<Sql> {
  // Re-resolve on each first connect so late-bound env is visible.
  dbSource = getDbSource();
  sqlPromise ??= createSql().catch((err) => {
    sqlPromise = null;
    throw err;
  });
  return sqlPromise;
}

export async function getPglite(): Promise<import("@electric-sql/pglite").PGlite> {
  if (getDbSource() !== "pglite") {
    throw new Error("getPglite() is only available on the PGLite fallback (no DATABASE_URL)");
  }
  await getSql();
  const pg = await globalRef.__pgliteInstance__;
  if (!pg) throw new Error("PGLite instance failed to initialize");
  return pg;
}

export function ensureDbReady(): Promise<void> {
  if (getDbSource() !== "pglite") return Promise.resolve();
  return getSql().then(() => undefined);
}

const globalBoot = globalThis as typeof globalThis & {
  __pgBootstrapPromise__?: Promise<void>;
};
if (typeof window === "undefined" && !isProductionRuntime()) {
  // В проде загрузку PGLite не запускаем: ошибка будет на первом getSql() с понятным текстом.
  globalBoot.__pgBootstrapPromise__ ??= Promise.resolve()
    .then(() => {
      if (getDbSource() !== "pglite") return;
      return ensureDbReady();
    })
    .catch((err) => {
      globalBoot.__pgBootstrapPromise__ = undefined;
      console.error("[db] PGLite bootstrap failed:", err);
      throw err;
    });
}
