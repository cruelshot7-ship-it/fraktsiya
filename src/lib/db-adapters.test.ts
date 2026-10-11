import { test } from "node:test";
import assert from "node:assert/strict";
import { runOnConnection, sqlFromPool, type Conn } from "./db-adapters.ts";

/** Фейковое соединение: пишет журнал запросов. */
function fakeConn(name: string, log: string[]): Conn & { release?: () => void } {
  return {
    query: async (text: string) => {
      log.push(`${name}:${text}`);
      return { rows: [] };
    },
  };
}

test("runOnConnection: BEGIN … COMMIT on one connection, returns fn result", async () => {
  const log: string[] = [];
  const conn = fakeConn("c1", log);
  const out = await runOnConnection(conn, async (tx) => {
    await tx.query("insert into t values (1)");
    return 42;
  });
  assert.equal(out, 42);
  assert.deepEqual(log, ["c1:BEGIN", "c1:insert into t values (1)", "c1:COMMIT"]);
});

test("runOnConnection: error → ROLLBACK and the original error is rethrown", async () => {
  const log: string[] = [];
  const conn = fakeConn("c1", log);
  await assert.rejects(
    runOnConnection(conn, async (tx) => {
      await tx.query("insert into t values (1)");
      throw new Error("boom");
    }),
    /boom/,
  );
  assert.deepEqual(log, ["c1:BEGIN", "c1:insert into t values (1)", "c1:ROLLBACK"]);
});

test("runOnConnection: a failing ROLLBACK does not hide the original error", async () => {
  const conn: Conn = {
    query: async (text: string) => {
      if (text === "ROLLBACK") throw new Error("connection lost");
      return { rows: [] };
    },
  };
  await assert.rejects(
    runOnConnection(conn, async () => {
      throw new Error("original");
    }),
    /original/,
  );
});

test("sqlFromPool.transaction pins one connection; queries inside never touch the pool", async () => {
  const log: string[] = [];
  let connects = 0;
  let releases = 0;
  const pool = {
    query: async (text: string) => {
      log.push(`pool:${text}`);
      return { rows: [] };
    },
    connect: async () => {
      connects += 1;
      const id = `client${connects}`;
      return {
        ...fakeConn(id, log),
        release: () => {
          releases += 1;
        },
      };
    },
  };
  const sql = sqlFromPool(pool);
  await sql.transaction(async (tx) => {
    await tx.query("select 1");
    await tx.query("select 2");
  });
  assert.equal(connects, 1);
  assert.equal(releases, 1);
  assert.deepEqual(log, [
    "client1:BEGIN",
    "client1:select 1",
    "client1:select 2",
    "client1:COMMIT",
  ]);
});

test("sqlFromPool: nested transaction joins the outer one (same connection, no second BEGIN)", async () => {
  const log: string[] = [];
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({ ...fakeConn("c1", log), release: () => undefined }),
  };
  const sql = sqlFromPool(pool);
  await sql.transaction(async (tx) => {
    await tx.transaction(async (inner) => {
      await inner.query("select inner");
    });
  });
  assert.deepEqual(log, ["c1:BEGIN", "c1:select inner", "c1:COMMIT"]);
});

test("sqlFromPool: connection is released even when the transaction throws", async () => {
  let releases = 0;
  const pool = {
    query: async () => ({ rows: [] }),
    connect: async () => ({
      ...fakeConn("c1", []),
      release: () => {
        releases += 1;
      },
    }),
  };
  const sql = sqlFromPool(pool);
  await assert.rejects(
    sql.transaction(async () => {
      throw new Error("fail");
    }),
    /fail/,
  );
  assert.equal(releases, 1);
});

test("sqlFromPool.query (no transaction) still goes to the pool", async () => {
  const log: string[] = [];
  const pool = {
    query: async (text: string) => {
      log.push(`pool:${text}`);
      return { rows: [{ n: 1 }] };
    },
    connect: async () => {
      throw new Error("should not connect");
    },
  };
  const sql = sqlFromPool(pool);
  const rows = await sql.query<{ n: number }>("select 1 as n");
  assert.deepEqual(rows, [{ n: 1 }]);
  assert.deepEqual(log, ["pool:select 1 as n"]);
});
