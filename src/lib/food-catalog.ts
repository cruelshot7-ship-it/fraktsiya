import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isCoachUser, loadStudioState } from "@/lib/studio-sync";
import { checkFoodProduct, FOOD_CATALOG_CAP, type SharedFood } from "@/lib/food-catalog-rules";

const AddInput = z.object({
  initData: z.string().optional(),
  product: z.custom<unknown>(() => true),
});

const ListInput = z.object({
  initData: z.string().optional(),
});

type Row = {
  barcode: string;
  name: string;
  brand: string | null;
  per100: SharedFood["per100"];
  quantity: string | null;
  serving_grams: string | number | null;
};

function rowToProduct(row: Row): SharedFood {
  return {
    barcode: row.barcode,
    name: row.name,
    brand: row.brand ?? undefined,
    per100: row.per100,
    quantity: row.quantity ?? undefined,
    servingGrams: row.serving_grams == null ? undefined : Number(row.serving_grams),
  };
}

/** Only the trainer and the studio's own clients read or add products. Anyone else gets nothing. */
async function knownSession(initData: string | undefined) {
  const { verifyTelegramInitData } = await import("@/lib/telegram-auth.server");
  const session = verifyTelegramInitData(initData);
  if (!session) return null;
  const state = await loadStudioState();
  const known = isCoachUser(state, session.user) || state.clients.some((c) => c.telegramId === session.user.id);
  return known ? session : null;
}

export const addFoodProductFn = createServerFn({ method: "POST" })
  .validator(AddInput)
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: string; existed?: boolean; product?: SharedFood }> => {
    const session = await knownSession(data.initData);
    if (!session) return { ok: false, reason: "not-allowed" };
    const check = checkFoodProduct(data.product);
    if (!check.ok) return { ok: false, reason: check.reason };
    const p = check.value;
    const db = await import("@/lib/db");
    const sql = await db.getSql();
    const inserted = await sql<{ barcode: string }>`
      insert into food_catalog (barcode, name, brand, per100, quantity, serving_grams)
      select ${p.barcode}, ${p.name}, ${p.brand ?? null}, ${JSON.stringify(p.per100)}::jsonb, ${p.quantity ?? null}, ${p.servingGrams ?? null}
      where (select count(*) from food_catalog) < ${FOOD_CATALOG_CAP}
      on conflict (barcode) do nothing
      returning barcode`;
    if (inserted.length) return { ok: true, product: p };
    // the code is already known: the first entry stands, a later add cannot overwrite it
    const rows = await sql<Row>`select barcode, name, brand, per100, quantity, serving_grams from food_catalog where barcode = ${p.barcode}`;
    if (rows[0]) return { ok: true, existed: true, product: rowToProduct(rows[0]) };
    return { ok: false, reason: "full" };
  });

export const listFoodProductsFn = createServerFn({ method: "POST" })
  .validator(ListInput)
  .handler(async ({ data }): Promise<{ ok: boolean; products: SharedFood[] }> => {
    const session = await knownSession(data.initData);
    if (!session) return { ok: false, products: [] };
    const db = await import("@/lib/db");
    const sql = await db.getSql();
    const rows = await sql<Row>`select barcode, name, brand, per100, quantity, serving_grams from food_catalog order by added_at desc limit ${FOOD_CATALOG_CAP}`;
    return { ok: true, products: rows.map(rowToProduct) };
  });
