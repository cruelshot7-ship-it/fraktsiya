import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { knownSession } from "@/lib/food-catalog";
import { isCoachUser, loadStudioState } from "@/lib/studio-sync";
import { checkManualProduct, manualExternalId, searchQuery } from "@/lib/food-reference-manual";
import type { FoodState, Per100, Quality } from "@/lib/food-reference-rules";

/** Ручные записи тренера: общий предел, как у штрихкодового каталога. */
export const MANUAL_CAP = 2000;

const SearchInput = z.object({
  initData: z.string().optional(),
  query: z.string().max(200),
  limit: z.number().int().min(1).max(50).optional(),
});

const AddInput = z.object({
  initData: z.string().optional(),
  product: z.custom<unknown>(() => true),
});

export type ReferenceRow = {
  id: string;
  source: "usda_fdc" | "manual";
  name: string;
  dataType: string | null;
  state: FoodState;
  per100: Per100;
  quality: Quality;
  status: "imported" | "verified" | "manual";
  sourceNote: string | null;
};

type Row = {
  external_id: string;
  source: "usda_fdc" | "manual";
  name: string;
  data_type: string | null;
  state: FoodState;
  kcal_100: string | null;
  protein_100: string | null;
  fat_100: string | null;
  carbs_100: string | null;
  fiber_100: string | null;
  quality: Quality;
  status: "imported" | "verified" | "manual";
  source_note: string | null;
};

const num = (v: string | null) => (v === null ? null : Number(v));

function toRow(r: Row): ReferenceRow {
  return {
    id: r.external_id,
    source: r.source,
    name: r.name,
    dataType: r.data_type,
    state: r.state,
    per100: {
      kcal: num(r.kcal_100),
      protein: num(r.protein_100),
      fat: num(r.fat_100),
      carbs: num(r.carbs_100),
      fiber: num(r.fiber_100),
    },
    quality: r.quality,
    status: r.status,
    sourceNote: r.source_note,
  };
}

/** Поиск по справочнику. Справочник не персональный: читают все известные пользователи студии. */
export const searchFoodReferenceFn = createServerFn({ method: "POST" })
  .validator(SearchInput)
  .handler(async ({ data }): Promise<{ ok: boolean; rows: ReferenceRow[]; reason?: string }> => {
    const session = await knownSession(data.initData);
    if (!session) return { ok: false, rows: [], reason: "not-allowed" };
    const q = searchQuery(data.query);
    if (!q) return { ok: true, rows: [] };
    const db = await import("@/lib/db");
    const sql = await db.getSql();
    const rows = await sql<Row>`
      select external_id, source, name, data_type, state, kcal_100, protein_100, fat_100, carbs_100, fiber_100,
             quality, status, source_note
        from food_reference
       where lower(name) like ${`%${q}%`}
       order by name
       limit ${data.limit ?? 20}`;
    return { ok: true, rows: rows.map(toRow) };
  });

/** Добавление продукта вручную. Только тренер (включая пробный и оплаченный доступ). */
export const addManualFoodFn = createServerFn({ method: "POST" })
  .validator(AddInput)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; row?: ReferenceRow }> => {
    const session = await knownSession(data.initData);
    if (!session) return { ok: false, reason: "not-allowed" };
    const state = await loadStudioState();
    if (!isCoachUser(state, session.user)) return { ok: false, reason: "forbidden" };
    const check = checkManualProduct(data.product);
    if (!check.ok) return { ok: false, reason: check.reason };
    const p = check.value;
    const { randomBytes } = await import("node:crypto");
    const id = manualExternalId(randomBytes(8).toString("hex"));
    const db = await import("@/lib/db");
    const sql = await db.getSql();
    const inserted = await sql<Row>`
      insert into food_reference
        (source, external_id, data_type, name, state, kcal_100, protein_100, fat_100, carbs_100, fiber_100,
         quality, status, source_note, created_by)
      select 'manual', ${id}, null, ${p.name}, ${p.state}::text,
             ${p.per100.kcal}::numeric, ${p.per100.protein}::numeric, ${p.per100.fat}::numeric,
             ${p.per100.carbs}::numeric, ${p.per100.fiber}::numeric,
             ${p.quality}::text, 'manual', ${p.sourceNote}, ${String(session.user.id)}
       where (select count(*) from food_reference where source = 'manual') < ${MANUAL_CAP}
      returning external_id, source, name, data_type, state, kcal_100, protein_100, fat_100, carbs_100, fiber_100,
                quality, status, source_note`;
    if (!inserted[0]) return { ok: false, reason: "full" };
    return { ok: true, row: toRow(inserted[0]) };
  });
