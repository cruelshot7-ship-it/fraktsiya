/**
 * Импорт USDA FoodData Central в справочник food_reference. Запускается владельцем вручную:
 *
 *   npm run import:usda -- --dir ./usda-foundation-and-sr-legacy --dry-run   # только разбор и отчёт, без записи
 *   DATABASE_URL=... npm run import:usda -- --dir ./usda-foundation-and-sr-legacy
 *
 * В папке должны быть food.csv, food_nutrient.csv и nutrient.csv из пакетной загрузки FDC.
 * Повторный запуск безопасен: записи сопоставляются по (источник, внешний id), дубликаты не создаются.
 * Прерванный импорт остаётся в журнале со статусом running; повторный запуск его доделает.
 * Строка подключения и значения записей в вывод не печатаются.
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { basename, join } from "node:path";
import {
  dedupeByExternalId,
  type Existing,
  type Per100,
  type ReferenceRecord,
} from "../src/lib/food-reference-rules";
import {
  checkNutrientTable,
  chunk,
  parseUsdaFood,
  planBatch,
  splitCsvLine,
  USDA_DATA_TYPES,
  USDA_NUTRIENTS,
  type NutrientRow,
  type UsdaFood,
} from "../src/lib/usda-import";

const SOURCE = "usda_fdc";
const BATCH = 200;
const SAMPLE_LIMIT = 20;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Строки файла потоком, с заголовком. Поле с переводом строки внутри кавычек склеивается. */
async function* csvRows(path: string): AsyncGenerator<string[]> {
  const rl = createInterface({ input: createReadStream(path, { encoding: "utf8" }), crlfDelay: Infinity });
  let pending = "";
  for await (const line of rl) {
    const text = pending ? `${pending}\n${line}` : line;
    const quotes = (text.match(/"/g) ?? []).length;
    if (quotes % 2 === 1) {
      pending = text;
      continue;
    }
    pending = "";
    if (text.trim() === "") continue;
    yield splitCsvLine(text);
  }
}

async function readNutrients(dir: string): Promise<Map<number, keyof Per100>> {
  const rows: NutrientRow[] = [];
  let header: string[] | null = null;
  for await (const cells of csvRows(join(dir, "nutrient.csv"))) {
    if (!header) {
      header = cells;
      continue;
    }
    const get = (k: string) => cells[header!.indexOf(k)] ?? "";
    rows.push({ id: Number(get("id")), name: get("name"), unit: get("unit_name") });
  }
  const check = checkNutrientTable(rows);
  if (!check.ok) {
    throw new Error(`nutrient.csv не совпадает с ожидаемыми номерами: ${check.mismatched.join(", ")}`);
  }
  const byId = new Map<number, keyof Per100>();
  for (const [key, meta] of Object.entries(USDA_NUTRIENTS)) byId.set(meta.id, key as keyof Per100);
  return byId;
}

async function readFoods(dir: string) {
  const foods = new Map<string, UsdaFood>();
  let read = 0;
  let wrongType = 0;
  let inFileDuplicates = 0;
  let header: string[] | null = null;
  for await (const cells of csvRows(join(dir, "food.csv"))) {
    if (!header) {
      header = cells;
      for (const col of ["fdc_id", "data_type", "description"]) {
        if (!header.includes(col)) throw new Error(`food.csv: нет колонки ${col}`);
      }
      continue;
    }
    read += 1;
    const get = (k: string) => cells[header!.indexOf(k)] ?? "";
    const dataType = get("data_type");
    if (!(USDA_DATA_TYPES as readonly string[]).includes(dataType)) {
      wrongType += 1;
      continue;
    }
    if (foods.has(get("fdc_id"))) {
      inFileDuplicates += 1;
      continue;
    }
    foods.set(get("fdc_id"), { fdcId: get("fdc_id"), dataType, description: get("description") });
  }
  return { foods, read, wrongType, inFileDuplicates };
}

async function readValues(dir: string, foods: Map<string, UsdaFood>, nutrientKey: Map<number, keyof Per100>) {
  const values = new Map<string, Partial<Record<keyof Per100, string>>>();
  let header: string[] | null = null;
  for await (const cells of csvRows(join(dir, "food_nutrient.csv"))) {
    if (!header) {
      header = cells;
      for (const col of ["fdc_id", "nutrient_id", "amount"]) {
        if (!header.includes(col)) throw new Error(`food_nutrient.csv: нет колонки ${col}`);
      }
      continue;
    }
    const get = (k: string) => cells[header!.indexOf(k)] ?? "";
    const fdc = get("fdc_id");
    if (!foods.has(fdc)) continue;
    const key = nutrientKey.get(Number(get("nutrient_id")));
    if (!key) continue;
    const entry = values.get(fdc) ?? {};
    entry[key] = get("amount");
    values.set(fdc, entry);
  }
  return values;
}

type Counts = { total: number; inserted: number; updated: number; unchanged: number; conflicts: number; skipped: number; errors: number };

async function main() {
  const dir = arg("dir");
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL?.trim();
  if (!dir) throw new Error("укажите папку: --dir <папка с food.csv, food_nutrient.csv, nutrient.csv>");
  if (!dryRun && !url) throw new Error("DATABASE_URL не задан");

  const nutrientKey = await readNutrients(dir);
  const { foods, wrongType, inFileDuplicates } = await readFoods(dir);
  const skippedByType = wrongType;
  const values = await readValues(dir, foods, nutrientKey);

  const records: ReferenceRecord[] = [];
  const skipReasons = new Map<string, number>();
  const skipSample: string[] = [];
  for (const food of foods.values()) {
    const parsed = parseUsdaFood(food, values.get(food.fdcId) ?? {});
    if (!parsed.ok) {
      skipReasons.set(parsed.reason, (skipReasons.get(parsed.reason) ?? 0) + 1);
      if (skipSample.length < SAMPLE_LIMIT) skipSample.push(`${food.fdcId}:${parsed.reason}`);
      continue;
    }
    records.push(parsed.value);
  }
  const unique = dedupeByExternalId(records);
  const duplicates = unique.duplicates + inFileDuplicates;

  const skippedByParse = [...skipReasons.values()].reduce((a, b) => a + b, 0);
  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          source: SOURCE,
          total: unique.unique.length,
          skipped: skippedByType + skippedByParse + duplicates,
          skipReasons: Object.fromEntries(skipReasons),
          skipSample,
        },
        null,
        2,
      ),
    );
    return;
  }
  // драйвер нужен только для записи; SSL задаётся sslmode в строке подключения
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();
  const counts: Counts = {
    total: unique.unique.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    conflicts: 0,
    skipped: skippedByType + skippedByParse + duplicates,
    errors: 0,
  };
  const conflictSample: string[] = [];
  const errorSample: string[] = [];

  try {
    const run = await client.query<{ id: string }>(
      `insert into food_import_runs (source, file_name, total, skipped)
       values ($1, $2, $3, $4) returning id`,
      [SOURCE, basename(dir), counts.total, counts.skipped],
    );
    const runId = Number(run.rows[0].id);

    try {
      for (const batch of chunk(unique.unique, BATCH)) {
        const ids = batch.map((r) => r.externalId);
        const found = await client.query<{
          external_id: string; name: string; state: string; status: "imported" | "verified";
          kcal_100: string | null; protein_100: string | null; fat_100: string | null; carbs_100: string | null; fiber_100: string | null;
        }>(
          `select external_id, name, state, status, kcal_100, protein_100, fat_100, carbs_100, fiber_100
             from food_reference where source = $1 and external_id = any($2::text[])`,
          [SOURCE, ids],
        );
        const num = (v: string | null) => (v === null ? null : Number(v));
        const existing = new Map<string, Existing>(
          found.rows.map((row) => [
            row.external_id,
            {
              name: row.name,
              state: row.state as Existing["state"],
              status: row.status,
              per100: { kcal: num(row.kcal_100), protein: num(row.protein_100), fat: num(row.fat_100), carbs: num(row.carbs_100), fiber: num(row.fiber_100) },
            },
          ]),
        );
        const plan = planBatch(batch, existing);
        counts.unchanged += plan.unchanged;
        counts.conflicts += plan.conflicts.length;
        for (const id of plan.conflicts) if (conflictSample.length < SAMPLE_LIMIT) conflictSample.push(id);

        const write = [...plan.inserts, ...plan.updates];
        if (write.length) {
          await client.query("begin");
          try {
            const params: unknown[] = [];
            const rows = write.map((r, i) => {
              const b = i * 14;
              params.push(SOURCE, r.externalId, r.dataType, r.name, r.state, r.per100.kcal, r.per100.protein, r.per100.fat, r.per100.carbs, r.per100.fiber, r.quality, "imported", runId, new Date().toISOString());
              return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, $${b + 13}, $${b + 14})`;
            });
            await client.query(
              `insert into food_reference
                 (source, external_id, data_type, name, state, kcal_100, protein_100, fat_100, carbs_100, fiber_100, quality, status, import_run_id, updated_at)
               values ${rows.join(", ")}
               on conflict (source, external_id) do update set
                 data_type = excluded.data_type, name = excluded.name, state = excluded.state,
                 kcal_100 = excluded.kcal_100, protein_100 = excluded.protein_100, fat_100 = excluded.fat_100,
                 carbs_100 = excluded.carbs_100, fiber_100 = excluded.fiber_100, quality = excluded.quality,
                 import_run_id = excluded.import_run_id, updated_at = excluded.updated_at
               where food_reference.status = 'imported'`,
              params,
            );
            await client.query("commit");
          } catch (err) {
            await client.query("rollback");
            throw err;
          }
        }
        counts.inserted += plan.inserts.length;
        counts.updated += plan.updates.length;
      }
      await client.query(
        `update food_import_runs set status = 'done', finished_at = now(),
           imported = $2, updated = $3, unchanged = $4, conflicts = $5, skipped = $6, errors = $7,
           error_sample = $8::jsonb where id = $1`,
        [runId, counts.inserted, counts.updated, counts.unchanged, counts.conflicts, counts.skipped, counts.errors,
          JSON.stringify({ skipReasons: Object.fromEntries(skipReasons), skipSample, conflictSample })],
      );
    } catch (err) {
      counts.errors += 1;
      errorSample.push(err instanceof Error ? err.message.slice(0, 300) : "unknown");
      await client.query(
        `update food_import_runs set status = 'failed', finished_at = now(), errors = $2,
           imported = $3, updated = $4, unchanged = $5, conflicts = $6, skipped = $7,
           error_sample = $8::jsonb where id = $1`,
        [runId, counts.errors, counts.inserted, counts.updated, counts.unchanged, counts.conflicts, counts.skipped, JSON.stringify({ errorSample })],
      );
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify({ source: SOURCE, ...counts, skipReasons: Object.fromEntries(skipReasons) }, null, 2));
}

main().catch((err) => {
  console.error(`[import-usda] ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
