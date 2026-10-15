/**
 * Выгрузка копии базы по запросу тренера. Файл отдаётся в ответ на запрос и никуда не отправляется:
 * ни в чат, ни в хранилище. Доступ — только тренеру, как у добавления продукта в справочник.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { knownSession } from "@/lib/food-catalog";
import { backupDay, backupFileName } from "@/lib/studio-backup";
import { isCoachUser, loadStudioState } from "@/lib/studio-sync";

const ExportInput = z.object({
  initData: z.string().optional(),
});

export type ExportResult =
  | { ok: true; fileName: string; json: string }
  | { ok: false; reason: "not-allowed" | "forbidden" };

export const exportStudioFn = createServerFn({ method: "POST" })
  .validator(ExportInput)
  .handler(async ({ data }): Promise<ExportResult> => {
    const session = await knownSession(data.initData);
    if (!session) return { ok: false, reason: "not-allowed" };
    const state = await loadStudioState();
    if (!isCoachUser(state, session.user)) return { ok: false, reason: "forbidden" };
    return { ok: true, fileName: backupFileName(backupDay()), json: JSON.stringify(state, null, 2) };
  });
